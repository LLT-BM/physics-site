<?php
declare(strict_types=1);
/* LibLabTab · комментарии. PHP 7.4+ и SQLite (pdo_sqlite), хостинг Reg.ru подходит. */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_BODY = 2000, MAX_NAME = 40, MAX_LINKS = 2, GAP_SEC = 20, PER_HOUR = 30;

function out($data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

/* Только запросы со своего сайта */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
  $oh = parse_url($origin, PHP_URL_HOST);
  $hh = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
  if (!$oh || strcasecmp($oh, $hh) !== 0) out(['error' => 'forbidden'], 403);
}

/* Хранилище */
$dir = __DIR__ . '/data';
if (!is_dir($dir) && !mkdir($dir, 0750, true)) out(['error' => 'storage'], 500);
if (!is_file($dir . '/.htaccess')) {
  file_put_contents($dir . '/.htaccess',
    "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n" .
    "<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n");
  file_put_contents($dir . '/index.html', '');
}
try {
  $db = new PDO('sqlite:' . $dir . '/comments.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->setAttribute(PDO::ATTR_TIMEOUT, 5);
  $db->exec('CREATE TABLE IF NOT EXISTS comments(
    id INTEGER PRIMARY KEY AUTOINCREMENT, page TEXT NOT NULL, parent INTEGER,
    author TEXT NOT NULL, body TEXT NOT NULL, likes INTEGER NOT NULL DEFAULT 0,
    token_hash TEXT NOT NULL, ip TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS ix_page ON comments(page, created_at)');
  $db->exec('CREATE TABLE IF NOT EXISTS likes_log(
    comment_id INTEGER NOT NULL, ip TEXT NOT NULL, PRIMARY KEY(comment_id, ip))');
} catch (Throwable $e) {
  out(['error' => 'storage'], 500);
}

$ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|llt');

function valid_page(string $p): bool {
  return $p !== '' && $p[0] === '/' && strlen($p) <= 200 && !preg_match('/[\x00-\x1f<>"\']/', $p);
}

/* Чтение ленты */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $page = (string)($_GET['page'] ?? '');
  if (!valid_page($page)) out([], 200);
  $st = $db->prepare('SELECT id,parent,author,body,likes,created_at FROM comments
                      WHERE page=? AND approved=1 ORDER BY created_at ASC LIMIT 500');
  $st->execute([$page]);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);
  foreach ($rows as &$r) {
    $r['id'] = (string)$r['id'];
    $r['parent'] = $r['parent'] === null ? null : (string)$r['parent'];
    $r['likes'] = (int)$r['likes'];
  }
  out($rows);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'method'], 405);
$in = json_decode((string)file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($in)) out(['error' => 'bad'], 400);
$action = (string)($in['action'] ?? 'add');

/* Лайк: один на IP */
if ($action === 'like') {
  $id = (int)($in['id'] ?? 0);
  $db->beginTransaction();
  $ins = $db->prepare('INSERT OR IGNORE INTO likes_log(comment_id, ip) VALUES(?,?)');
  $ins->execute([$id, $ip]);
  if ($ins->rowCount() > 0) {
    $db->prepare('UPDATE comments SET likes=likes+1 WHERE id=? AND approved=1')->execute([$id]);
  }
  $db->commit();
  $st = $db->prepare('SELECT likes FROM comments WHERE id=?');
  $st->execute([$id]);
  out(['ok' => true, 'likes' => (int)$st->fetchColumn()]);
}

/* Удаление своего комментария по токену */
if ($action === 'delete') {
  $id = (int)($in['id'] ?? 0);
  $tok = (string)($in['token'] ?? '');
  $st = $db->prepare('SELECT token_hash FROM comments WHERE id=?');
  $st->execute([$id]);
  $h = $st->fetchColumn();
  if (!$h || !hash_equals((string)$h, hash('sha256', $tok))) out(['error' => 'forbidden'], 403);
  $db->prepare('DELETE FROM comments WHERE id=? OR parent=?')->execute([$id, $id]);
  out(['ok' => true]);
}

/* Новый комментарий */
if ($action !== 'add') out(['error' => 'bad'], 400);
if (!empty($in['website'])) out(['ok' => true, 'id' => '0', 'token' => '']);   /* ловушка для ботов */

$page   = (string)($in['page'] ?? '');
$author = trim(preg_replace('/\s+/u', ' ', (string)($in['author'] ?? '')));
$author = mb_substr($author, 0, MAX_NAME);
$body   = trim(str_replace("\r", '', (string)($in['body'] ?? '')));
$body   = mb_substr($body, 0, MAX_BODY);
$parent = isset($in['parent']) && $in['parent'] !== null ? (int)$in['parent'] : null;

if (!valid_page($page) || $author === '' || mb_strlen($body) < 2) out(['error' => 'bad'], 400);
if (preg_match_all('~https?://|www\.~i', $body) > MAX_LINKS) out(['error' => 'links'], 422);

$st = $db->prepare('SELECT COUNT(*) FROM comments WHERE ip=? AND created_at > ?');
$st->execute([$ip, gmdate('c', time() - GAP_SEC)]);
if ((int)$st->fetchColumn() > 0) out(['error' => 'too_fast'], 429);
$st->execute([$ip, gmdate('c', time() - 3600)]);
if ((int)$st->fetchColumn() >= PER_HOUR) out(['error' => 'too_many'], 429);

if ($parent !== null) {
  $st = $db->prepare('SELECT 1 FROM comments WHERE id=? AND page=? AND parent IS NULL');
  $st->execute([$parent, $page]);
  if (!$st->fetchColumn()) out(['error' => 'bad_parent'], 400);
}

$token = bin2hex(random_bytes(16));
$db->prepare('INSERT INTO comments(page,parent,author,body,token_hash,ip,created_at) VALUES(?,?,?,?,?,?,?)')
   ->execute([$page, $parent, $author, $body, hash('sha256', $token), $ip, gmdate('c')]);
out(['ok' => true, 'id' => (string)$db->lastInsertId(), 'token' => $token]);