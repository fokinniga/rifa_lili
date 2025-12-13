let currentGroups = {};
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    loadReservations();
    setInterval(loadReservations, 5000); // Auto-refresh every 5 seconds
});

function setFilter(filter) {
    currentFilter = filter;
    renderReservations();
}

async function loadReservations() {
    try {
        const res = await fetch('/api/admin/reservations');
        const tickets = await res.json();

        // Group by user/contact
        const groups = {};
        tickets.forEach(t => {
            const key = `${t.holder_name}|${t.holder_contact}`;
            if (!groups[key]) {
                groups[key] = {
                    name: t.holder_name,
                    contact: t.holder_contact,
                    tickets: [],
                    status: t.status
                };
            }
            groups[key].tickets.push(t);
        });

        currentGroups = groups;
        renderReservations();

    } catch (err) {
        console.error(err);
        document.getElementById('reservationsList').innerHTML = '<p>Error al cargar datos.</p>';
    }
}

function renderReservations() {
    const list = document.getElementById('reservationsList');
    list.innerHTML = '';

    const filteredGroups = Object.values(currentGroups).filter(group => {
        const isSold = group.tickets.every(t => t.status === 'sold');
        const status = isSold ? 'sold' : 'reserved';
        if (currentFilter === 'all') return true;
        return status === currentFilter;
    });

    if (filteredGroups.length === 0) {
        list.innerHTML = '<p>No hay reservas en esta categoría.</p>';
        return;
    }

    filteredGroups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'reservation-card';

        const ticketNumbers = group.tickets.map(t => t.number.toString().padStart(5, '0')).join(', ');
        const isSold = group.tickets.every(t => t.status === 'sold');
        const statusClass = isSold ? 'status-sold' : 'status-reserved';
        const statusText = isSold ? 'VENDIDO' : 'RESERVADO';

        // WhatsApp Link for Admin to contact Client
        let waButton = '';
        if (!group.contact.includes('@')) {
            // Clean number: remove non-digits
            const cleanNumber = group.contact.replace(/\D/g, '');
            const text = encodeURIComponent(`Hola ${group.name}, confirmamos que tu pago por los boletos ${ticketNumbers} ha sido APROBADO. ¡Mucha suerte!`);
            const waLink = `https://wa.me/521${cleanNumber}?text=${text}`; // Assuming MX prefix 521
            waButton = `<a href="${waLink}" target="_blank" class="btn-secondary" style="background-color:#25D366; text-decoration:none; display:inline-block; margin-top:5px;">Enviar WA</a>`;
        }

        card.innerHTML = `
            <div class="reservation-info">
                <h3>${group.name}</h3>
                <p><strong>Contacto:</strong> ${group.contact} ${waButton}</p>
                <p><strong>Boletos (${group.tickets.length}):</strong> ${ticketNumbers}</p>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="reservation-actions">
                ${!isSold ? `<button class="btn-primary" onclick="approveReservation('${ticketNumbers}')">Aprobar Pago</button>` : ''}
                <button class="btn-danger" onclick="releaseReservation('${ticketNumbers}')">Liberar / Cancelar</button>
            </div>
        `;
        list.appendChild(card);
    });
}

async function approveReservation(numbersStr) {
    if (!confirm('¿Confirmar pago y marcar como VENDIDOS?')) return;

    const numbers = numbersStr.split(', ').map(n => parseInt(n));

    try {
        const res = await fetch('/api/admin/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadReservations();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Error de conexión');
    }
}

async function releaseReservation(numbersStr) {
    if (!confirm('¿Estás seguro de LIBERAR estos boletos? Volverán a estar disponibles.')) return;

    const numbers = numbersStr.split(', ').map(n => parseInt(n));

    try {
        const res = await fetch('/api/admin/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadReservations();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Error de conexión');
    }
}
