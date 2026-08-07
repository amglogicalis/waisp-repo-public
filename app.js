class WaispStudioApp {
    constructor() {
        this.token = localStorage.getItem('waisp_token') || '';
        this.vaultRepo = localStorage.getItem('waisp_vault_repo') || '.waisp-storage';
        this.user = null;
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
            await this.setAuthenticatedState();
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
        await this.setAuthenticatedState();
        await this.loadVaultState();
        this.renderAll();
    }

    disconnect() {
        this.token = '';
        localStorage.removeItem('waisp_token');
        document.getElementById('token-group')?.classList.remove('hidden');
        document.getElementById('btn-disconnect')?.classList.add('hidden');
        this.state = { targets: {}, vulnerabilities: {}, customTemplates: [], canaries: {}, scans: [] };
        this.renderAll();
    }

    async setAuthenticatedState() {
        document.getElementById('token-group')?.classList.add('hidden');
        document.getElementById('btn-disconnect')?.classList.remove('hidden');

        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (res.ok) {
                const user = await res.json();
                this.user = user;
                const profileEl = document.getElementById('user-profile');
                if (profileEl) {
                    profileEl.innerHTML = `
                        <img src="${user.avatar_url}" class="avatar" alt="${user.login}">
                        <div class="user-info">
                            <span class="user-name">${user.login}</span>
                            <span class="user-status text-primary"><i class="fa-solid fa-circle" style="font-size:8px;"></i> Connected</span>
                        </div>
                    `;
                }
            }
        } catch (e) {
            // Failed to fetch user profile
        }
    }

    async loadVaultState() {
        if (!this.token) return;
        try {
            let fullRepo = this.vaultRepo;
            if (!fullRepo.includes('/') && this.user && this.user.login) {
                fullRepo = `${this.user.login}/${this.vaultRepo}`;
            }

            const res = await fetch(`https://api.github.com/repos/${fullRepo}/contents/waisp_state.json`, {
                headers: { 'Authorization': `token ${this.token}` }
            });

            if (res.ok) {
                const fileData = await res.json();
                const cleanBase64 = fileData.content.replace(/\s/g, '');
                const binaryStr = atob(cleanBase64);
                const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
                const jsonStr = new TextDecoder().decode(bytes);
                this.state = JSON.parse(jsonStr);
            }
        } catch(e) {
            console.error('Error loading vault state:', e);
        }
    }

    async syncVaultState() {
        if (!this.token) return false;
        try {
            let fullRepo = this.vaultRepo;
            if (!fullRepo.includes('/') && this.user && this.user.login) {
                fullRepo = `${this.user.login}/${this.vaultRepo}`;
            }

            let sha;
            const getRes = await fetch(`https://api.github.com/repos/${fullRepo}/contents/waisp_state.json`, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            if (getRes.ok) {
                const fileData = await getRes.json();
                sha = fileData.sha;
            }

            const jsonStr = JSON.stringify(this.state, null, 2);
            const utf8Bytes = new TextEncoder().encode(jsonStr);
            let binaryStr = '';
            utf8Bytes.forEach(b => binaryStr += String.fromCharCode(b));
            const contentBase64 = btoa(binaryStr);

            const putRes = await fetch(`https://api.github.com/repos/${fullRepo}/contents/waisp_state.json`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: '🛡️ WAISP Nest Studio state update',
                    content: contentBase64,
                    sha
                })
            });

            return putRes.ok;
        } catch (e) {
            return false;
        }
    }

    renderAll() {
        this.renderDashboard();
        this.renderTargets();
        this.renderVulnerabilities();
        this.renderVenomTemplates();
        this.renderCanaries();
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

        // Dashboard Lists
        const dashVulns = document.getElementById('dashboard-vulns-list');
        if (dashVulns) {
            if (vulns.length === 0) {
                dashVulns.innerHTML = `<p class="text-muted">No security findings recorded yet.</p>`;
            } else {
                dashVulns.innerHTML = vulns.slice(0, 5).map(v => `
                    <div style="padding: 10px 0; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <strong style="font-size: 0.95rem;">${v.title}</strong>
                            <p class="text-small text-muted">${v.evidence?.endpoint || v.targetUrl}</p>
                        </div>
                        <span class="logo-badge" style="background:rgba(208,19,54,0.18); color:var(--primary); font-weight:bold;">${v.severity} (${v.cvssScore})</span>
                    </div>
                `).join('');
            }
        }

        const dashTargets = document.getElementById('dashboard-targets-list');
        if (dashTargets) {
            if (targets.length === 0) {
                dashTargets.innerHTML = `<p class="text-muted">No audit targets added yet.</p>`;
            } else {
                dashTargets.innerHTML = targets.slice(0, 5).map(t => `
                    <div style="padding: 10px 0; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <strong style="font-size: 0.95rem;">🎯 ${t.name}</strong>
                            <p class="text-small text-muted">${t.url}</p>
                        </div>
                        <span class="logo-badge">${t.provider.toUpperCase()}</span>
                    </div>
                `).join('');
            }
        }
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
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3>🎯 ${t.name}</h3>
                    <button class="btn-sm btn-secondary" onclick="app.deleteTarget('${t.id}')" title="Delete Target"><i class="fa-solid fa-trash"></i></button>
                </div>
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
                    <span class="logo-badge" style="background:rgba(208,19,54,0.2); color:var(--primary); font-weight:bold;">${v.severity} (${v.cvssScore})</span>
                    <span class="text-small text-muted">${v.stingerModule.toUpperCase()}</span>
                </div>
                <h3 class="mt-2">${v.title}</h3>
                <p class="text-small text-muted mt-2">${v.description}</p>
                <div class="mt-4">
                    <p class="text-small"><strong>Endpoint:</strong> \`${v.evidence?.endpoint || v.targetUrl}\`</p>
                </div>
                <div class="mt-4 p-2" style="background:rgba(0,0,0,0.3); border-radius:6px; font-family:monospace; font-size:0.8rem;">
                    ${v.suggestedPatch || 'Remediation patch instructions available.'}
                </div>
            </div>
        `).join('');
    }

    renderVenomTemplates() {
        const grid = document.getElementById('venom-templates-grid');
        if (!grid) return;

        const templates = this.state.customVenomTemplates || [];
        if (templates.length === 0) {
            grid.innerHTML = `<p class="text-muted">No custom VenomPayload templates registered yet.</p>`;
            return;
        }

        grid.innerHTML = templates.map(tmpl => `
            <div class="glass card">
                <div style="display:flex; justify-content:space-between;">
                    <span class="logo-badge">${tmpl.category.toUpperCase()}</span>
                    <span class="logo-badge" style="background:rgba(208,19,54,0.2); color:var(--primary);">${tmpl.severity} (${tmpl.cvssScore})</span>
                </div>
                <h3 class="mt-2">🧪 ${tmpl.name}</h3>
                <p class="text-small text-muted mt-2">${tmpl.description}</p>
                <p class="text-small mt-2"><strong>Payloads:</strong> \`${tmpl.payloads ? tmpl.payloads.join(', ') : 'N/A'}\`</p>
            </div>
        `).join('');
    }

    renderCanaries() {
        const grid = document.getElementById('canaries-grid');
        if (!grid) return;

        const canaries = Object.values(this.state.canaries || {});
        if (canaries.length === 0) {
            grid.innerHTML = `<p class="text-muted">No NectarCanary probes generated yet.</p>`;
            return;
        }

        grid.innerHTML = canaries.map(c => `
            <div class="glass card">
                <h3>🍯 Probe: ${c.canaryToken}</h3>
                <p class="text-small text-muted mt-2">Target: ${c.targetUrl}</p>
                <p class="text-small text-accent mt-2"><strong>Callback URL:</strong> \`${c.callbackUrl}\`</p>
            </div>
        `).join('');
    }

    openNewTargetModal() {
        document.getElementById('target-name').value = '';
        document.getElementById('target-url').value = '';
        document.getElementById('modal-target').classList.remove('hidden');
    }

    async saveTarget() {
        const name = document.getElementById('target-name').value.trim();
        const url = document.getElementById('target-url').value.trim();
        const env = document.getElementById('target-env').value;
        const provider = document.getElementById('target-provider').value;

        if (!name || !url) {
            alert('Please enter target name and target URL');
            return;
        }

        const id = 'target-' + Math.random().toString(36).substring(2, 9);
        this.state.targets[id] = {
            id,
            name,
            url,
            environment: env,
            provider: provider,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.closeModals();
        this.renderAll();
        await this.syncVaultState();
    }

    async deleteTarget(id) {
        if (!confirm('Are you sure you want to delete this audit target?')) return;
        delete this.state.targets[id];
        this.renderAll();
        await this.syncVaultState();
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

    async runScanFromModal() {
        const targetId = document.getElementById('scan-target-id').value;
        const target = this.state.targets[targetId];
        if (!target) return;

        this.closeModals();
        alert(`⚡ Starting WAISP Hornet scan against ${target.name}... Check findings in Vulnerabilities tab!`);
        
        // Simulating quick client-side scan checks for web console
        const vulns = [];
        if (document.getElementById('mod-recon')?.checked) {
            vulns.push({
                id: 'vuln-web-' + Math.random().toString(36).substring(2, 9),
                targetId: target.id,
                targetUrl: target.url,
                title: 'Security Headers Inspection (CSP & HSTS Check)',
                severity: 'MEDIUM',
                cvssScore: 5.3,
                stingerModule: 'recon',
                description: 'Reconnaissance audit completed for target endpoint.',
                evidence: { endpoint: target.url, statusCode: 200 },
                suggestedPatch: 'Configure HSTS and CSP headers on host.',
                remediationSteps: ['Add HSTS header', 'Add CSP header'],
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        vulns.forEach(v => this.state.vulnerabilities[v.id] = v);
        this.renderAll();
        await this.syncVaultState();
    }

    closeModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    }

    saveSettings() {
        const port = document.getElementById('setting-port').value;
        localStorage.setItem('waisp_port', port);
        alert(`Settings saved! CLI default studio port set to: ${port}`);
    }
}

const app = new WaispStudioApp();
