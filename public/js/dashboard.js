const ctx = document.getElementById('trafficChart').getContext('2d');
let chart;

async function loadDashboard() {
  const response = await fetch('/api/dashboard-summary');
  const data = await response.json();

  document.getElementById('totalLogins').textContent = data.totalLogins;
  document.getElementById('activeUsers').textContent = data.activeUsers;

  const labels = data.trafficHistory.map(item => new Date(item.time).toLocaleTimeString());
  const values = data.trafficHistory.map(item => item.activeUsers);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Active Users Traffic',
        data: values,
        borderColor: '#c9a96e',
        backgroundColor: 'rgba(201,169,110,0.08)',
        pointBackgroundColor: '#c9a96e',
        pointBorderColor: '#0a0a0a',
        pointRadius: 4,
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#7a7570', font: { family: 'Montserrat', size: 11, weight: '300' }, boxWidth: 12 }
        }
      },
      scales: {
        x: {
          ticks: { color: '#4a4642', font: { family: 'Montserrat', size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(255,255,255,0.08)' }
        },
        y: {
          ticks: { color: '#4a4642', font: { family: 'Montserrat', size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { color: 'rgba(255,255,255,0.08)' }
        }
      }
    }
  });
  }

loadDashboard();
setInterval(loadDashboard, 10000);