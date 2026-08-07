class WaispStudioApp {
    constructor() {
        this.token = localStorage.getItem('waisp_token') || '';
        this.vaultRepo = localStorage.getItem('waisp_vault_repo') || '.waisp-storage';
        this.state = {
            targets: {},
            vulnerabilities: {},
            customTemplates: [],
            canaries: {},
            scans: []
        };

        this.init();
    }

    async init() {
        this.bindEvents();
        if (this.token) {
            this.setAuthenticatedState();
            await this.loadVaultState();
        }
        this.renderAll();
    }

    bindEvents() {
        document.getElementById('btn-connect')?.addEventListener('click', () => this.connect());
        document.getElementById('btn-disconnect')?.addEventListener('click', () => this.disconnect());

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchView(view);
            });
        });
    }

    switchView(viewId) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');

        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`view-${viewId}`)?.classList.remove('hidden');
    }

    async connect() {
        const tokenInput = document.getElementById('github-token');
        if (!tokenInput || !tokenInput.value) return;

        this.token = tokenInput.value.trim();
        localStorage.setItem('waisp_token', this.token);
        this.setAuthenticatedState();
        await this.loadVaultState();
        this.renderAll();
    }

    disconnect() {
        this.token = '';
        localStorage.removeItem('waisp_token');
        document.getElementById('token-group').classList.remove('hidden');
        document.getElementById('btn-disconnect').classList.add('hidden');
        this.state = { targets: {}, vulnerabilities: {}, customTemplates: [], canaries: {}, scans: [] };
        this.renderAll();
    }

    setAuthenticatedState() {
        document.getElementById('token-group').classList.add('hidden');
        document.getElementById('btn-disconnect').classList.remove('hidden');
    }

    async loadVaultState() {
        if (!this.token) return;
        try {
            const res = await fetch(`https://api.github.com/repos/${this.vaultRepo}/contents/waisp_state.json`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (res.ok) {
                const fileData = await res.json();
                const jsonStr = atob(fileData.content);
                this.state = JSON.parse(jsonStr);
            }
        } catch(e) { /* ignore */ }
    }

    renderAll() {
        this.renderDashboard();
        this.renderTargets();
        this.renderVulnerabilities();
    }

    renderDashboard() {
        const targets = Object.values(this.state.targets || {});
        const vulns = Object.values(this.state.vulnerabilities || {});

        const critical = vulns.filter(v => v.severity === 'CRITICAL').length;
        const highmed = vulns.filter(v => v.severity === 'HIGH' || v.severity === 'MEDIUM').length;
        const maxCvss = vulns.reduce((max, v) => Math.max(max, v.cvssScore || 0), 0);

        document.getElementById('stat-targets').textContent = targets.length;
        document.getElementById('stat-critical').textContent = critical;
        document.getElementById('stat-highmed').textContent = highmed;
        document.getElementById('stat-cvss').textContent = maxCvss.toFixed(1);
    }

    renderTargets() {
        const grid = document.getElementById('targets-grid');
        if (!grid) return;

        const targets = Object.values(this.state.targets || {});
        if (targets.length === 0) {
            grid.innerHTML = `<p class="text-muted">No targets added yet. Click "Add Target" to configure your first audit target.</p>`;
            return;
        }

        grid.innerHTML = targets.map(t => `
            <div class="glass card">
                <h3>🎯 ${t.name}</h3>
                <p class="text-small text-muted mt-2">${t.url}</p>
                <div class="mt-4 flex gap-2">
                    <span class="logo-badge">${t.environment.toUpperCase()}</span>
                    <span class="logo-badge" style="background:rgba(250,204,21,0.15); color:var(--accent);">${t.provider.toUpperCase()}</span>
                </div>
            </div>
        `).join('');
    }

    renderVulnerabilities() {
        const grid = document.getElementById('vulns-grid');
        if (!grid) return;

        const vulns = Object.values(this.state.vulnerabilities || {});
        if (vulns.length === 0) {
            grid.innerHTML = `<p class="text-muted">No vulnerability findings recorded.</p>`;
            return;
        }

        grid.innerHTML = vulns.map(v => `
            <div class="glass card">
                <div style="display:flex; justify-content:space-between;">
                    <span class="logo-badge" style="background:rgba(239,68,68,0.2); color:var(--danger);">${v.severity} (${v.cvssScore})</span>
                    <span class="text-small text-muted">${v.stingerModule.toUpperCase()}</span>
                </div>
                <h3 class="mt-2">${v.title}</h3>
                <p class="text-small text-muted mt-2">${v.description}</p>
                <div class="mt-4">
                    <p class="text-small"><strong>Endpoint:</strong> ${v.evidence?.endpoint || v.targetUrl}</p>
                </div>
            </div>
        `).join('');
    }

    openNewTargetModal() {
        document.getElementById('modal-target').classList.remove('hidden');
    }

    openNewScanModal() {
        const targetSelect = document.getElementById('scan-target-id');
        const targets = Object.values(this.state.targets || {});
        if (targets.length === 0) {
            alert('Please add an audit target first!');
            return;
        }

        targetSelect.innerHTML = targets.map(t => `<option value="${t.id}">${t.name} (${t.url})</option>`).join('');
        document.getElementById('modal-scan').classList.remove('hidden');
    }

    closeModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    }
}

const app = new WaispStudioApp();
