const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./raffle.db');

console.log("Conectando a la base de datos para agregar los boletos faltantes...");

db.serialize(() => {
    // Usamos una consulta recursiva (CTE) para insertar 40,000 registros de un solo golpe.
    // Esto se ejecuta internamente en SQLite y es miles de veces más rápido.
    const query = `
        INSERT OR IGNORE INTO tickets (number, status)
        WITH RECURSIVE
          cte(x) AS (
             SELECT 10001
             UNION ALL
             SELECT x+1 FROM cte WHERE x < 50000
          )
        SELECT x, 'available' FROM cte;
    `;

    console.log("Insertando boletos del 10,001 al 50,000 de manera optimizada...");
    
    db.run(query, [], function(err) {
        if (err) {
            console.error("Error al guardar los cambios en la base de datos:", err.message);
        } else {
            console.log(`Se han procesado los boletos. Nuevos boletos agregados: ${this.changes}`);
            
            // Comprobamos el total final en la base de datos
            db.get("SELECT count(*) as total FROM tickets", (err, row) => {
                if (!err) {
                    console.log(`El total de boletos en la base de datos ahora es: ${row.total}`);
                }
                db.close();
            });
        }
    });
});
