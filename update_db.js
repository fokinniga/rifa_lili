const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./raffle.db');

console.log("Conectando a la base de datos para agregar los boletos faltantes...");

db.serialize(() => {
    // Usamos INSERT OR IGNORE para que solo inserte números que no existen aún.
    // Así evitamos errores o duplicados si se ejecuta por accidente más de una vez.
    const stmt = db.prepare("INSERT OR IGNORE INTO tickets (number, status) VALUES (?, 'available')");

    console.log("Iniciando inserción del boleto 10,001 al 50,000. Esto puede tardar unos segundos...");
    db.run("BEGIN TRANSACTION");
    
    for (let i = 10001; i <= 50000; i++) {
        stmt.run(i);
    }

    db.run("COMMIT", (err) => {
        if (err) {
            console.error("Error al guardar los cambios en la base de datos:", err.message);
        } else {
            console.log("Los boletos han sido agregados correctamente.");
            
            // Comprobamos el total final en la base de datos
            db.get("SELECT count(*) as total FROM tickets", (err, row) => {
                if (!err) {
                    console.log(`El total de boletos en la base de datos ahora es: ${row.total}`);
                }
                db.close();
            });
        }
    });
    
    stmt.finalize();
});
