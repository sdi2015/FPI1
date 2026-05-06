// CCTV Camera Warranty Service Ticket Dashboard Logic
// Focus: Warranty review, RMA tracking, ROI analysis

let allTickets = [];
let filteredTickets = [];
let cameras = [];
let rmaData = [];
let charts = {};
let currentSort = { field: null, ascending: true };

// Load and initialize
window.addEventListener('DOMContentLoaded', () => {
    loadData();
});

function loadData() {
    try {
        // Load all data
        cameras = CAMERA_DATA || [];
        allTickets = WARRANTY_QUEUE_DATA || [];
        rmaData = RMA_CLAIMS_DATA || [];
        
        filteredTickets = [...allTickets];
        
        // Update last updated time
        document.getElementById('last-updated').textContent = 
            `Last updated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`;
        
        initializeFilters();
        renderDashboard();
        
        console.log(`Loaded ${cameras.length} cameras, ${allTickets.length} warranty review tickets, ${rmaData.length} RMA claims`);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading dashboard data. Please check console for details.');
    }
}

function initializeFilters() {
    // Populate manufacturer filter
    const manufacturers = [...new Set(allTickets.map(t => t.Manufacturer))].filter(Boolean).sort();
    const manufacturerFilter = document.getElementById('filter-manufacturer');
    manufacturers.forEach(mfg => {
        const option = document.createElement('option');
        option.value = mfg;
        option.textContent = mfg;
        manufacturerFilter.appendChild(option);
    });

    // Populate region filter
    const regions = [...new Set(allTickets.map(t => t.Region))].filter(Boolean).sort();
    const regionFilter = document.getElementById('filter-region');
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionFilter.appendChild(option);
    });

    // Populate action filter
    const actions = [...new Set(allTickets.map(t => t['Recommended Action']))].filter(Boolean).sort();
    const actionFilter = document.getElementById('filter-action');
    actions.forEach(action => {
        const option = document.createElement('option');
        option.value = action;
        option.textContent = action;
        actionFilter.appendChild(option);
    });

    // Add search listener
    document.getElementById('search-box').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
}

function applyFilters() {
    const manufacturerFilter = document.getElementById('filter-manufacturer').value;
    const priorityFilter = document.getElementById('filter-priority').value;
    const regionFilter = document.getElementById('filter-region').value;
    const actionFilter = document.getElementById('filter-action').value;
    const searchText = document.getElementById('search-box').value.toLowerCase();

    filteredTickets = allTickets.filter(ticket => {
        if (manufacturerFilter !== 'all' && ticket.Manufacturer !== manufacturerFilter) return false;
        if (priorityFilter !== 'all' && ticket.Priority !== priorityFilter) return false;
        if (regionFilter !== 'all' && ticket.Region !== regionFilter) return false;
        if (actionFilter !== 'all' && ticket['Recommended Action'] !== actionFilter) return false;
        
        if (searchText) {
            const searchableText = [
                ticket['Service Ticket ID'],
                ticket['Camera ID'],
                ticket['Site Name'],
                ticket['Serial Number']
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchText)) return false;
        }
        
        return true;
    });

    renderDashboard();
}

function resetFilters() {
    document.getElementById('filter-manufacturer').value = 'all';
    document.getElementById('filter-priority').value = 'all';
    document.getElementById('filter-region').value = 'all';
    document.getElementById('filter-action').value = 'all';
    document.getElementById('search-box').value = '';
    
    filteredTickets = [...allTickets];
    renderDashboard();
}

function renderDashboard() {
    updateKPIs();
    updateROIMetrics();
    renderCharts();
    renderTable();
    updateCounts();
}

function updateKPIs() {
    // Calculate KPIs - use DASHBOARD_TOTALS for counts when full data not loaded
    const totalCameras = DASHBOARD_TOTALS?.totalCameras || cameras.length;
    const totalTickets = DASHBOARD_TOTALS?.totalTickets || (TICKET_DATA ? TICKET_DATA.length : 0);
    const pendingReview = allTickets.length;
    const noClaimsSubmitted = allTickets.length; // All warranty queue items have no claims
    
    const avoidableSpend = filteredTickets.reduce((sum, t) => {
        const val = parseFloat(t['Avoidable Replacement Cost']) || 0;
        return sum + val;
    }, 0);
    
    const recoveryValue = filteredTickets.reduce((sum, t) => {
        const val = parseFloat(t['Potential Warranty Recovery Value']) || 0;
        return sum + val;
    }, 0);
    
    const netRecovery = filteredTickets.reduce((sum, t) => {
        const avoidable = parseFloat(t['Avoidable Replacement Cost']) || 0;
        const admin = 150; // Admin cost per claim
        return sum + (avoidable > 0 ? avoidable - admin : 0);
    }, 0);
    
    const activeRMA = rmaData.length;

    // Update KPI display
    document.getElementById('kpi-total-cameras').textContent = totalCameras.toLocaleString();
    document.getElementById('kpi-total-tickets').textContent = totalTickets.toLocaleString();
    document.getElementById('kpi-pending-review').textContent = pendingReview.toLocaleString();
    document.getElementById('kpi-no-claims').textContent = noClaimsSubmitted.toLocaleString();
    document.getElementById('kpi-avoidable-spend').textContent = `$${Math.round(avoidableSpend).toLocaleString()}`;
    document.getElementById('kpi-recovery-value').textContent = `$${Math.round(recoveryValue).toLocaleString()}`;
    document.getElementById('kpi-net-recovery').textContent = `$${Math.round(netRecovery).toLocaleString()}`;
    document.getElementById('kpi-active-rma').textContent = activeRMA.toLocaleString();
    document.getElementById('total-recovery').textContent = `$${Math.round(netRecovery).toLocaleString()}`;
}

function updateROIMetrics() {
    const totalAvoidable = allTickets.reduce((sum, t) => sum + (parseFloat(t['Avoidable Replacement Cost']) || 0), 0);
    const warrantyEligible = TICKET_DATA ? TICKET_DATA.filter(t => t['Warranty Eligible at Failure Date'] === 'Yes').length : 0;
    const claimsSubmitted = rmaData.length;
    const utilizationRate = warrantyEligible > 0 ? (claimsSubmitted / warrantyEligible * 100) : 0;
    
    const netRecoverable = allTickets.reduce((sum, t) => {
        const avoidable = parseFloat(t['Avoidable Replacement Cost']) || 0;
        return sum + (avoidable > 0 ? avoidable - 150 : 0);
    }, 0);
    
    const programCost = 25000;
    const roiDollars = netRecoverable - programCost;
    const roiPercentage = programCost > 0 ? (roiDollars / programCost * 100) : 0;
    
    const replacementPurchases = allTickets.filter(t => t['Replacement Purchased'] === 'Yes').length;

    document.getElementById('roi-utilization').textContent = `${utilizationRate.toFixed(1)}%`;
    document.getElementById('roi-leakage').textContent = `$${Math.round(totalAvoidable).toLocaleString()}`;
    document.getElementById('roi-percentage').textContent = `${Math.round(roiPercentage).toLocaleString()}%`;
    document.getElementById('roi-purchases').textContent = replacementPurchases.toLocaleString();
}

function updateCounts() {
    document.getElementById('visible-count').textContent = filteredTickets.length.toLocaleString();
    document.getElementById('total-count').textContent = allTickets.length.toLocaleString();
}

function renderCharts() {
    renderManufacturerChart();
    renderRegionChart();
    renderPriorityChart();
    renderActionChart();
}

function renderManufacturerChart() {
    const manufacturerSpend = {};
    filteredTickets.forEach(ticket => {
        const mfg = ticket.Manufacturer;
        const spend = parseFloat(ticket['Avoidable Replacement Cost']) || 0;
        manufacturerSpend[mfg] = (manufacturerSpend[mfg] || 0) + spend;
    });

    const sortedMfg = Object.entries(manufacturerSpend)
        .sort((a, b) => b[1] - a[1]);

    const ctx = document.getElementById('manufacturerChart');
    if (charts.manufacturer) charts.manufacturer.destroy();
    
    charts.manufacturer = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMfg.map(m => m[0]),
            datasets: [{
                label: 'Avoidable Spend',
                data: sortedMfg.map(m => m[1]),
                backgroundColor: '#0071CE'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `$${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `$${value.toLocaleString()}`
                    }
                }
            }
        }
    });
}

function renderRegionChart() {
    const regionSpend = {};
    filteredTickets.forEach(ticket => {
        const region = ticket.Region;
        const spend = parseFloat(ticket['Avoidable Replacement Cost']) || 0;
        regionSpend[region] = (regionSpend[region] || 0) + spend;
    });

    const sortedRegion = Object.entries(regionSpend)
        .sort((a, b) => b[1] - a[1]);

    const ctx = document.getElementById('regionChart');
    if (charts.region) charts.region.destroy();
    
    charts.region = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedRegion.map(r => r[0]),
            datasets: [{
                label: 'Avoidable Spend',
                data: sortedRegion.map(r => r[1]),
                backgroundColor: '#FFC220'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `$${context.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `$${value.toLocaleString()}`
                    }
                }
            }
        }
    });
}

function renderPriorityChart() {
    const priorityCounts = {};
    filteredTickets.forEach(ticket => {
        const priority = ticket.Priority;
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    const priorityOrder = ['Critical', 'High', 'Medium', 'Low'];
    const colors = {
        'Critical': '#dc2626',
        'High': '#ea580c',
        'Medium': '#FFC220',
        'Low': '#9ca3af'
    };

    const ctx = document.getElementById('priorityChart');
    if (charts.priority) charts.priority.destroy();
    
    charts.priority = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: priorityOrder,
            datasets: [{
                data: priorityOrder.map(p => priorityCounts[p] || 0),
                backgroundColor: priorityOrder.map(p => colors[p])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderActionChart() {
    const actionCounts = {};
    filteredTickets.forEach(ticket => {
        const action = ticket['Recommended Action'];
        actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    const sortedActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1]);

    const ctx = document.getElementById('actionChart');
    if (charts.action) charts.action.destroy();
    
    charts.action = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedActions.map(a => a[0]),
            datasets: [{
                label: 'Tickets',
                data: sortedActions.map(a => a[1]),
                backgroundColor: '#0071CE'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    // Show first 100 tickets
    const displayTickets = filteredTickets.slice(0, 100);
    
    if (displayTickets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-gray-500">
                    No tickets match your filters. Try adjusting your search criteria.
                </td>
            </tr>
        `;
        document.getElementById('table-info').innerHTML = '';
        return;
    }
    
    displayTickets.forEach(ticket => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-blue-50 cursor-pointer transition';
        row.onclick = () => showTicketDetails(ticket);
        
        const priority = ticket.Priority || '';
        const priorityClass = 
            priority === 'Critical' ? 'priority-critical' :
            priority === 'High' ? 'priority-high' :
            priority === 'Medium' ? 'priority-medium' :
            'priority-low';
        
        const action = ticket['Recommended Action'] || '';
        let actionClass = 'action-check';
        if (action.includes('Submit')) actionClass = 'action-submit';
        else if (action.includes('Review')) actionClass = 'action-review';
        else if (action.includes('Escalate')) actionClass = 'action-escalate';
        
        const daysLeft = parseInt(ticket['Days Until Warranty Expiration']) || 0;
        const daysDisplay = daysLeft < 0 ? 
            `<span class="font-bold text-red-600">${daysLeft} (EXPIRED)</span>` :
            daysLeft <= 30 ?
            `<span class="font-bold text-orange-600">${daysLeft}</span>` :
            daysLeft <= 90 ?
            `<span class="font-bold text-yellow-600">${daysLeft}</span>` :
            `<span class="text-gray-700">${daysLeft}</span>`;
        
        const recoveryValue = parseFloat(ticket['Potential Warranty Recovery Value']) || 0;
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-blue-600">${ticket['Service Ticket ID'] || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${ticket['Camera ID'] || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${ticket.Manufacturer || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${ticket['Site Name'] || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-700">#${ticket['Store Location'] || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${ticket.Market || ''}</td>
            <td class="px-4 py-3 text-sm">
                <span class="status-badge ${priorityClass}">${priority}</span>
            </td>
            <td class="px-4 py-3 text-sm">${daysDisplay}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${ticket['Replacement Purchased'] || 'No'}</td>
            <td class="px-4 py-3 text-sm font-bold text-green-600">$${recoveryValue.toLocaleString()}</td>
            <td class="px-4 py-3 text-sm">
                <span class="action-badge ${actionClass}">${action}</span>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Table info
    const info = document.getElementById('table-info');
    if (filteredTickets.length > 100) {
        info.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                Showing first 100 of ${filteredTickets.length} tickets. Use filters to narrow results.
            </div>
        `;
    } else {
        info.innerHTML = `Showing all ${filteredTickets.length} tickets.`;
    }
}

function showTicketDetails(ticket) {
    const details = `
Warranty Review Ticket Details:
================================

Service Ticket ID: ${ticket['Service Ticket ID'] || 'N/A'}
Camera ID: ${ticket['Camera ID'] || 'N/A'}
Asset Tag: ${ticket['Asset Tag'] || 'N/A'}

Camera Info:
-----------
Manufacturer: ${ticket.Manufacturer || 'N/A'}
Model: ${ticket.Model || 'N/A'}
Serial Number: ${ticket['Serial Number'] || 'N/A'}

Location:
---------
Site: ${ticket['Site Name'] || 'N/A'}
Region: ${ticket.Region || 'N/A'}
Market: ${ticket.Market || 'N/A'}
Location: ${ticket['Camera Location'] || 'N/A'}

Ticket Info:
-----------
Created: ${ticket['Ticket Created Date'] || 'N/A'}
Failure Date: ${ticket['Failure Date'] || 'N/A'}
Priority: ${ticket.Priority || 'N/A'}
Issue: ${ticket['Issue Category'] || 'N/A'}
Status: ${ticket['Ticket Status'] || 'N/A'}

Warranty Info:
-------------
Warranty End Date: ${ticket['Warranty End Date'] || 'N/A'}
Days Until Expiration: ${ticket['Days Until Warranty Expiration'] || 'N/A'}
Replacement Recommended: ${ticket['Replacement Recommended'] || 'N/A'}
Replacement Purchased: ${ticket['Replacement Purchased'] || 'N/A'}

Financial Impact:
----------------
Estimated Replacement Cost: $${parseFloat(ticket['Estimated Replacement Cost'] || 0).toLocaleString()}
Avoidable Replacement Cost: $${parseFloat(ticket['Avoidable Replacement Cost'] || 0).toLocaleString()}
Potential Warranty Recovery: $${parseFloat(ticket['Potential Warranty Recovery Value'] || 0).toLocaleString()}

Action Required:
---------------
Recommended Action: ${ticket['Recommended Action'] || 'N/A'}
Warranty Review Status: ${ticket['Warranty Review Status'] || 'N/A'}

Next Steps:
----------
1. Review camera failure details
2. Verify warranty eligibility
3. Submit RMA claim to manufacturer
4. Track claim in RMA Claim Tracker
    `;
    
    alert(details);
}

function sortBy(field) {
    if (currentSort.field === field) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.field = field;
        currentSort.ascending = true;
    }

    filteredTickets.sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];
        
        // Handle nulls
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        
        // Handle dates
        if (field.includes('Date')) {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }
        
        // Handle numbers
        if (field === 'Days Until Warranty Expiration' || field.includes('Value') || field.includes('Cost')) {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        }
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return currentSort.ascending ? -1 : 1;
        if (aVal > bVal) return currentSort.ascending ? 1 : -1;
        return 0;
    });

    renderTable();
}

function exportToCSV() {
    const headers = [
        'Service Ticket ID', 'Camera ID', 'Asset Tag', 'Manufacturer', 'Model',
        'Serial Number', 'Site Name', 'Region', 'Market', 'Camera Location',
        'Ticket Created Date', 'Failure Date', 'Warranty End Date',
        'Days Until Warranty Expiration', 'Priority', 'Issue Category',
        'Replacement Recommended', 'Replacement Purchased',
        'Estimated Replacement Cost', 'Avoidable Replacement Cost',
        'Potential Warranty Recovery Value', 'Recommended Action'
    ];
    
    const rows = filteredTickets.map(t => headers.map(h => {
        const value = t[h];
        return value !== null && value !== undefined ? `"${value}"` : '""';
    }));

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `warranty_review_queue_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
