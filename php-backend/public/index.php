<?php
require __DIR__ . '/../vendor/autoload.php';

use App\Db;

#echo json_encode(Db::connect()->query( 'SELECT * FROM users LIMIT 1')->fetchAll());

header('Content-Type: application/json');

function singin(): void
{
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';
    $password_hash = password_hash(password, PASSWORD_BCRYPT);

    $pdo = Db::connect();
    $stmt = $pdo->prepare('
        INSERT INTO users(username, password_hash)
        VALUES :username, :password_hash
        RETURNING user_id
    ');
    $stmt->execute(['username' => $username, 'password_hash' => $password_hash]);
    $user = $stmt->fetch();

    if(!$user){
        http_response_code(401);
        echo json_encode(['error' => 'Database error']);
        return;
    }

    session_start();
    $_SESSION['user_id'] = $user['user_id'];

    echo json_encode(['ok' => true]);
}

function login(): void
{
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    $pdo = Db::connect();
    $stmt = $pdo->prepare('
        SELECT user_id, password_hash
        FROM users
        WHERE username = :username
    ');
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])){
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        return;
    }

    session_start();
    $_SESSION['user_id'] = $user['user_id'];

    echo json_encode(['ok' => true]);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($method === 'POST' && $path === '/login') {
    login();
} else if ($method === 'POST' && $path === '/signin'){
    signin();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}