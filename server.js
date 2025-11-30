const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database Setup
const db = new sqlite3.Database('./raffle.db');

db.serialize(() => {
    // Create tickets table
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        number INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'available', -- available, reserved, sold
        holder_name TEXT,
        holder_contact TEXT,
        reservation_date DATETIME
    )`);

    // Initialize 10,000 tickets if empty
    db.get("SELECT count(*) as count FROM tickets", (err, row) => {
        if (row.count === 0) {
            console.log("Initializing 10,000 tickets... This might take a moment.");
            const stmt = db.prepare("INSERT INTO tickets (number, status) VALUES (?, 'available')");
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                for (let i = 1; i <= 10000; i++) {
                    stmt.run(i);
                }
                db.run("COMMIT");
            });
            stmt.finalize();
            console.log("Initialization complete.");
        }
    });
});

// Configure Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fokinniga@gmail.com',
        pass: 'ijyuxqsroiqythrb'
    }
});

async function sendConfirmationEmail(email, name, numbers) {
    if (!email || !email.includes('@')) return;

    const mailOptions = {
        from: '"Gran Rifa 2025" <fokinniga@gmail.com>',
        to: email,
        subject: 'Confirmación de Reserva - Gran Rifa 2025',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #008f39; border-radius: 5px;">
                <h2 style="color: #008f39;">¡Hola ${name}!</h2>
                <p>Has reservado exitosamente los siguientes boletos:</p>
                <h3 style="background-color: #f0f0f0; padding: 10px; display: inline-block;">${numbers.join(', ')}</h3>
                <p><strong>Estado:</strong> Pendiente de Pago</p>
                <p>Por favor, realiza tu pago y envía el comprobante al administrador para validar tu compra.</p>
                <hr>
                <small>Si no realizaste esta reserva, por favor ignora este correo.</small>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Correo de reserva enviado a ${email}`);
    } catch (error) {
        console.error('Error enviando correo:', error);
    }
}

async function sendApprovalEmail(email, name, numbers) {
    if (!email || !email.includes('@')) return;

    const mailOptions = {
        from: '"Gran Rifa 2025" <fokinniga@gmail.com>',
        to: email,
        subject: '¡Pago Aprobado! - Gran Rifa 2025',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #008f39; border-radius: 5px;">
                <h2 style="color: #008f39;">¡Gracias ${name}!</h2>
                <p>Tu pago ha sido confirmado y tus boletos están oficialmente asegurados.</p>
                <h3 style="background-color: #d4edda; padding: 10px; display: inline-block; color: #155724;">${numbers.join(', ')}</h3>
                <p><strong>Estado:</strong> PAGADO / APROBADO</p>
                <p>¡Mucha suerte!</p>
                <hr>
                <small>Gran Rifa 2025</small>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Correo de aprobación enviado a ${email}`);
    } catch (error) {
        console.error('Error enviando correo de aprobación:', error);
    }
}

// API Routes

app.get('/api/tickets', (req, res) => {
    db.all("SELECT number, status FROM tickets", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/admin/reservations', (req, res) => {
    db.all("SELECT * FROM tickets WHERE status IN ('reserved', 'sold') ORDER BY reservation_date DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reserve', (req, res) => {
    const { numbers, name, contact } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ error: "No se seleccionaron números." });
    }
    if (!name || !contact) {
        return res.status(400).json({ error: "Faltan datos de contacto." });
    }

    const placeholders = numbers.map(() => '?').join(',');
    db.all(`SELECT number FROM tickets WHERE number IN (${placeholders}) AND status != 'available'`, numbers, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        if (rows.length > 0) {
            const taken = rows.map(r => r.number).join(', ');
            return res.status(409).json({ error: `Los siguientes números ya no están disponibles: ${taken}` });
        }

        const updateStmt = db.prepare(`UPDATE tickets SET status = 'reserved', holder_name = ?, holder_contact = ?, reservation_date = datetime('now') WHERE number = ?`);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            numbers.forEach(num => {
                updateStmt.run(name, contact, num);
            });
            db.run("COMMIT", (err) => {
                if (err) return res.status(500).json({ error: err.message });

                if (contact.includes('@')) {
                    sendConfirmationEmail(contact, name, numbers);
                }

                res.json({ success: true, message: "Boletos reservados con éxito. Se ha enviado un correo con los detalles." });
            });
        });
        updateStmt.finalize();
    });
});

app.post('/api/admin/approve', (req, res) => {
    const { numbers } = req.body;
    if (!numbers || !numbers.length) return res.status(400).json({ error: "No numbers provided" });

    const placeholders = numbers.map(() => '?').join(',');

    // Get contact info first
    db.get(`SELECT holder_name, holder_contact FROM tickets WHERE number = ?`, [numbers[0]], (err, row) => {
        const contact = row ? row.holder_contact : null;
        const name = row ? row.holder_name : 'Cliente';

        db.run(`UPDATE tickets SET status = 'sold' WHERE number IN (${placeholders})`, numbers, function (err) {
            if (err) return res.status(500).json({ error: err.message });

            if (contact && contact.includes('@')) {
                sendApprovalEmail(contact, name, numbers);
            }

            res.json({ success: true, message: `Se aprobaron ${this.changes} boletos.` });
        });
    });
});

app.post('/api/admin/release', (req, res) => {
    const { numbers } = req.body;
    if (!numbers || !numbers.length) return res.status(400).json({ error: "No numbers provided" });

    const placeholders = numbers.map(() => '?').join(',');
    db.run(`UPDATE tickets SET status = 'available', holder_name = NULL, holder_contact = NULL, reservation_date = NULL WHERE number IN (${placeholders})`, numbers, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Se liberaron ${this.changes} boletos.` });
    });
});

// Automatic Cleanup Task
function cleanupExpiredReservations() {
    console.log('Running cleanup for expired reservations...');
    const twelveHoursAgo = "datetime('now', '-12 hours')";

    db.run(`UPDATE tickets 
            SET status = 'available', holder_name = NULL, holder_contact = NULL, reservation_date = NULL 
            WHERE status = 'reserved' AND reservation_date < ${twelveHoursAgo}`,
        function (err) {
            if (err) {
                console.error("Error cleaning up expired tickets:", err.message);
            } else if (this.changes > 0) {
                console.log(`Auto-released ${this.changes} expired tickets.`);
            }
        });
}

setInterval(cleanupExpiredReservations, 60 * 60 * 1000);
cleanupExpiredReservations();

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
