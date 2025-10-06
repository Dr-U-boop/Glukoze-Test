let currentToken = null;
let currentPatientId = null;
let patients = [];
let glucoseChart = null;

// --- DOM Элементы ---
const patientsListEl = document.getElementById('patients-list');
const welcomeMessageEl = document.getElementById('welcome-message');
const patientDetailsEl = document.getElementById('patient-details');
const patientNameEl = document.getElementById('patient-name');
const chartCanvas = document.getElementById('glucose-chart').getContext('2d');
const recommendationsListEl = document.getElementById('recommendations-list');
const startDateInput = document.getElementById('start-date');
const startTimeInput = document.getElementById('start-time');
const endDateInput = document.getElementById('end-date');
const endTimeInput = document.getElementById('end-time');
const updateChartBtn = document.getElementById('update-chart-btn');
const resetChartBtn = document.getElementById('reset-chart-btn');

// --- Инициализация ---
window.electronAPI.handleToken((token) => {
    currentToken = token;
    sessionStorage.setItem('accessToken', currentToken);
    fetchAndRenderPatients();
});

// --- Функции ---
async function apiFetch(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
        }
    };
    const response = await fetch(`http://127.0.0.1:8000${endpoint}`, { ...defaultOptions, ...options });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Ошибка API: ${response.statusText}`);
    }
    return response.json();
}

async function fetchAndRenderPatients() {
    try {
        patients = await apiFetch('/api/patients/');
        patientsListEl.innerHTML = '';
        patients.forEach(patient => {
            const li = document.createElement('li');
            li.className = 'patient-item';
            li.dataset.patientId = patient.id;
            const statusClass = Math.random() > 0.3 ? 'status-ok' : 'status-attention';
            li.innerHTML = `<div class="status-indicator ${statusClass}"></div><span>${patient.full_name}</span>`;
            li.addEventListener('click', () => {
                document.querySelectorAll('.patient-item').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
                displayPatientDetails(patient.id);
            });
            patientsListEl.appendChild(li);
        });
    } catch (error) { console.error("Не удалось загрузить пациентов:", error); }
}

async function displayPatientDetails(patientId) {
    currentPatientId = patientId;
    try {
        welcomeMessageEl.classList.add('hidden');
        patientDetailsEl.classList.remove('hidden');

        const patient = await apiFetch(`/api/patients/${patientId}`);
        patientNameEl.textContent = patient.full_name;

        startDateInput.value = '';
        endDateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';

        const [chartData, recommendationsData] = await Promise.all([
            apiFetch(`/api/patients/${currentPatientId}/comprehensive_data`),
            apiFetch(`/api/patients/${currentPatientId}/recommendations`)
        ]);
        
        renderComprehensiveChart(chartData);
        renderRecommendations(recommendationsData);
    } catch (error) { console.error("Не удалось загрузить данные пациента:", error); }
}

async function updateComprehensiveChart() {
    if (!currentPatientId) return;
    let endpoint = `/api/patients/${currentPatientId}/comprehensive_data`;

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    if (startDate && endDate) {
        const startTime = startTimeInput.value || "00:00";
        const endTime = endTimeInput.value || "23:59";
        const startISO = `${startDate}T${startTime}`;
        const endISO = `${endDate}T${endTime}`;
        endpoint += `?start_datetime=${startISO}&end_datetime=${endISO}`;
    }
    
    try {
        const chartData = await apiFetch(endpoint);
        renderComprehensiveChart(chartData);
    } catch (error) { console.error("Не удалось обновить график:", error); }
}

function renderComprehensiveChart(apiData) {
    if (glucoseChart) glucoseChart.destroy();
    glucoseChart = new Chart(chartCanvas, {
        type: 'bar',
        data: {
            datasets: [
                { type: 'line', label: 'Глюкоза (ммоль/л)', data: apiData.glucose, borderColor: 'rgb(0, 123, 255)', backgroundColor: 'rgba(0, 123, 255, 0.5)', yAxisID: 'yGlucose', tension: 0.2, pointRadius: 1 },
                { type: 'line', label: 'Углеводы (г)', data: apiData.carbs, backgroundColor: 'rgba(255, 7, 7, 0.7)', yAxisID: 'yEvents' },
                { type: 'line', label: 'Инсулин (ЕД)', data: apiData.insulin, backgroundColor: 'rgba(255, 5, 201, 1)', yAxisID: 'yEvents' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { decimation: { enabled: true, algorithm: 'lttb', samples: 200, threshold: 500 } },
            scales: {
                x: { type: 'time', time: { tooltipFormat: 'dd.MM.yyyy HH:mm' } },
                yGlucose: { position: 'left', title: { display: true, text: 'Глюкоза (ммоль/л)' } },
                yEvents: { position: 'right', title: { display: true, text: 'Углеводы (г) / Инсулин (ЕД)' }, grid: { drawOnChartArea: false }, beginAtZero: true }
            }
        }
    });
}

function renderRecommendations(data) {
    recommendationsListEl.innerHTML = '';
    if (data.recommendations && data.recommendations.length > 0) {
        data.recommendations.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            recommendationsListEl.appendChild(li);
        });
    }
}

// --- Обработчики событий ---
updateChartBtn.addEventListener('click', updateComprehensiveChart);
resetChartBtn.addEventListener('click', () => {
    if (currentPatientId) displayPatientDetails(currentPatientId);
});