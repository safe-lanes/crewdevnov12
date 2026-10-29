import pg from "pg";

function denyConnection(): never {
  throw new Error("Database connections are forbidden in isolated unit tests. Mock the database boundary.");
}

pg.Client.prototype.connect = denyConnection;
pg.Pool.prototype.connect = denyConnection;
