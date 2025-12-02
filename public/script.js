const ITEMS_PER_PAGE = 200;
let currentPage = 1;
let allTickets = []; // This will hold the status of all 10k tickets (lightweight array)
let selectedTickets = new Set();

document.addEventListener('DOMContentLoaded', () => {
    fetchTickets();
    setInterval(fetchTickets, 5000); // Auto-refresh every 5 seconds

    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
    document.getElementById('searchTicket').addEventListener('input', handleSearch);
    document.getElementById('reserveForm').addEventListener('submit', handleReservation);
    document.getElementById('ticketInput').addEventListener('input', parseInputToSelection);
});

async function fetchTickets() {
    try {
        const res = await fetch('/api/tickets');
        const data = await res.json();
        // Filter out sold tickets so they don't appear in the list
        allTickets = data.filter(t => t.status !== 'sold');
        renderGrid();
    } catch (err) {
        console.error("Error fetching tickets:", err);
    }
}

function renderGrid() {
    const grid = document.getElementById('ticketsGrid');
    grid.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = allTickets.slice(start, end);

    document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${Math.ceil(allTickets.length / ITEMS_PER_PAGE)}`;

    pageItems.forEach(ticket => {
        const div = document.createElement('div');
        div.className = `ticket ${ticket.status}`;
        if (selectedTickets.has(ticket.number)) {
            div.classList.add('selected');
        }
        div.textContent = ticket.number.toString().padStart(5, '0');

        if (ticket.status === 'available') {
            div.onclick = () => toggleSelection(ticket.number);
        }

        grid.appendChild(div);
    });
}

function changePage(delta) {
    const maxPage = Math.ceil(allTickets.length / ITEMS_PER_PAGE);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= maxPage) {
        currentPage = newPage;
        renderGrid();
    }
}

function toggleSelection(number) {
    if (selectedTickets.has(number)) {
        selectedTickets.delete(number);
    } else {
        selectedTickets.add(number);
    }
    updateInputFromSelection();
    renderGrid(); // Re-render to show selection state
}

function updateInputFromSelection() {
    const sorted = Array.from(selectedTickets).sort((a, b) => a - b);
    document.getElementById('ticketInput').value = sorted.join(', ');
}

function parseInputToSelection(e) {
    // This is a bit complex to sync perfectly two-way, so we'll just do simple parsing
    // Ideally we parse the string and update 'selectedTickets'
    const val = e.target.value;
    const parts = val.split(',').map(s => s.trim());
    const newSelection = new Set();

    parts.forEach(part => {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) newSelection.add(i);
            }
        } else {
            const num = parseInt(part);
            if (!isNaN(num)) newSelection.add(num);
        }
    });

    // Only update if valid numbers and within range
    selectedTickets = new Set([...newSelection].filter(n => n >= 1 && n <= 10000));
    // We don't re-render immediately on every keystroke to avoid lag, maybe debounce?
    // For now, let's just leave it visually unsynced until user clicks or we can add a "Update View" button
    // Or just re-render current page
    renderGrid();
}

function handleSearch(e) {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= 10000) {
        // Find page
        const index = allTickets.findIndex(t => t.number === val);
        if (index !== -1) {
            currentPage = Math.floor(index / ITEMS_PER_PAGE) + 1;
            renderGrid();
            // Highlight logic could be added here
        }
    }
}

async function handleReservation(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const contact = document.getElementById('contact').value;

    // Parse input again to be sure
    const inputVal = document.getElementById('ticketInput').value;
    // Reuse logic or just use selectedTickets if we trust the sync
    // Let's re-parse input to be safe as user might have typed manually
    const parts = inputVal.split(',').map(s => s.trim());
    const numbersToReserve = [];

    parts.forEach(part => {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) numbersToReserve.push(i);
            }
        } else {
            const num = parseInt(part);
            if (!isNaN(num)) numbersToReserve.push(num);
        }
    });

    if (numbersToReserve.length === 0) {
        showMessage('Por favor selecciona al menos un número.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers: numbersToReserve, name, contact })
        });

        const data = await res.json();

        if (res.ok) {
            let successMsg = data.message;

            // Logic for WhatsApp
            // Assuming Admin Number is needed here. Let's use a placeholder or ask user.
            // For now, we'll generate a link to send TO the admin.
            // We need the Admin's number. I'll use a placeholder '521XXXXXXXXXX'.
            const adminNumber = '528125425997'; // Número del Administrador actualizado

            if (!contact.includes('@')) {
                const text = encodeURIComponent(`Hola, acabo de reservar los boletos: ${numbersToReserve.join(', ')}. Mi nombre es ${name}.`);
                const waLink = `https://wa.me/${adminNumber}?text=${text}`;

                successMsg += ` <br><br><a href="${waLink}" target="_blank" style="background:#25D366;color:white;padding:5px 10px;text-decoration:none;border-radius:4px;">Enviar comprobante por WhatsApp</a>`;
            }

            showMessage(successMsg, 'success');
            // Don't clear immediately so they can click the link
            // selectedTickets.clear();
            // document.getElementById('ticketInput').value = '';
            // document.getElementById('reserveForm').reset();
            fetchTickets();
        } else {
            showMessage(data.error, 'error');
        }
    } catch (err) {
        showMessage('Error de conexión.', 'error');
    }
}

function showMessage(msg, type) {
    const el = document.getElementById('message');
    el.innerHTML = msg;
    el.className = `message ${type}`;
    el.style.display = 'block'; // Ensure it's visible

    // If it's a success message (likely containing a link), give more time
    const time = type === 'success' ? 30000 : 5000;

    if (window.msgTimeout) clearTimeout(window.msgTimeout);
    window.msgTimeout = setTimeout(() => el.style.display = 'none', time);
}
