<?php
namespace App;

use PDO;

class Db
{
    public static function connect(): PDO
    {
        $dsn = 'pgsql:host=localhost;port=5432;dbname=scrapy2';

        return new PDO($dsn, 'admin', 'local_password',[
            PDO::ATTR_ERRMODE               => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE    => PDO::FETCH_ASSOC,
        ]);
    }
}