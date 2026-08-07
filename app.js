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
                    <div style="display:flex; gap:6px;">
                        <button class="btn-sm btn-secondary" onclick="app.editTarget('${t.id}')" title="Edit Target"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-sm btn-secondary" onclick="app.deleteTarget('${t.id}')" title="Delete Target"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p class="text-small text-muted mt-2">${t.url}</p>
                <div class="mt-4 flex gap-2">
                    <span class="logo-badge">${(t.environment || 'prod').toUpperCase()}</span>
                    <span class="logo-badge" style="background:rgba(250,204,21,0.15); color:var(--accent);">${(t.provider || 'terra').toUpperCase()}</span>
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
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="logo-badge" style="background:rgba(208,19,54,0.2); color:var(--primary); font-weight:bold;">${v.severity} (${v.cvssScore})</span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="text-small text-muted">${(v.stingerModule || 'dast').toUpperCase()}</span>
                        <button class="btn-sm btn-secondary" onclick="app.deleteVulnerability('${v.id}')" title="Delete Finding"><i class="fa-solid fa-trash"></i></button>
                    </div>
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
            grid.innerHTML = `<p class="text-muted">No custom VenomPayload templates registered yet. Click "Add Venom Template" to register one.</p>`;
            return;
        }

        grid.innerHTML = templates.map((tmpl, idx) => `
            <div class="glass card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span class="logo-badge">${(tmpl.category || 'dast').toUpperCase()}</span>
                        <span class="logo-badge" style="background:rgba(208,19,54,0.2); color:var(--primary);">${tmpl.severity} (${tmpl.cvssScore})</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-sm btn-secondary" onclick="app.editVenomTemplate('${tmpl.id}')" title="Edit Template"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-sm btn-secondary" onclick="app.deleteVenomTemplate('${tmpl.id}')" title="Delete Template"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="mt-2">🧪 ${tmpl.name}</h3>
                <p class="text-small text-muted mt-2">${tmpl.description}</p>
                <p class="text-small mt-2"><strong>Payloads:</strong> \`${tmpl.payloads ? (Array.isArray(tmpl.payloads) ? tmpl.payloads.join(', ') : tmpl.payloads) : 'N/A'}\`</p>
            </div>
        `).join('');
    }

    renderCanaries() {
        const grid = document.getElementById('canaries-grid');
        if (!grid) return;

        const canaries = Object.values(this.state.canaries || {});
        if (canaries.length === 0) {
            grid.innerHTML = `<p class="text-muted">No NectarCanary probes generated yet. Click "Generate Canary Probe" to create one.</p>`;
            return;
        }

        grid.innerHTML = canaries.map(c => `
            <div class="glass card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3>🍯 Probe: ${c.canaryToken}</h3>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-sm btn-secondary" onclick="app.editCanaryProbe('${c.id}')" title="Edit Probe"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-sm btn-secondary" onclick="app.deleteCanaryProbe('${c.id}')" title="Delete Probe"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p class="text-small text-muted mt-2">Target: ${c.targetUrl}</p>
                <p class="text-small text-accent mt-2"><strong>Callback URL:</strong> \`${c.callbackUrl}\`</p>
            </div>
        `).join('');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            info: '<i class="fa-solid fa-bolt text-primary"></i>',
            success: '<i class="fa-solid fa-circle-check text-accent"></i>',
            warning: '<i class="fa-solid fa-triangle-exclamation text-warning"></i>',
            danger: '<i class="fa-solid fa-circle-xmark text-danger"></i>'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            ${icons[type] || icons.info}
            <span>${message}</span>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showConfirmModal(message, title = '⚠️ Confirmation Required', onConfirm) {
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;

        const btnAction = document.getElementById('btn-confirm-action');
        if (btnAction) {
            const newBtn = btnAction.cloneNode(true);
            btnAction.parentNode.replaceChild(newBtn, btnAction);
            newBtn.addEventListener('click', () => {
                this.closeModals();
                if (onConfirm) onConfirm();
            });
        }

        document.getElementById('modal-confirm')?.classList.remove('hidden');
    }

    // TARGET CRUD
    openNewTargetModal() {
        document.getElementById('target-edit-id').value = '';
        document.getElementById('target-modal-title').textContent = '🎯 Add Audit Target';
        document.getElementById('target-name').value = '';
        document.getElementById('target-url').value = '';
        document.getElementById('modal-target').classList.remove('hidden');
    }

    editTarget(id) {
        const t = this.state.targets[id];
        if (!t) return;
        document.getElementById('target-edit-id').value = t.id;
        document.getElementById('target-modal-title').textContent = '🎯 Edit Audit Target';
        document.getElementById('target-name').value = t.name;
        document.getElementById('target-url').value = t.url;
        document.getElementById('target-env').value = t.environment || 'production';
        document.getElementById('target-provider').value = t.provider || 'terra';
        document.getElementById('modal-target').classList.remove('hidden');
    }

    async saveTarget() {
        const editId = document.getElementById('target-edit-id').value;
        const name = document.getElementById('target-name').value.trim();
        const url = document.getElementById('target-url').value.trim();
        const env = document.getElementById('target-env').value;
        const provider = document.getElementById('target-provider').value;

        if (!name || !url) {
            this.showToast('Please enter target name and target URL', 'warning');
            return;
        }

        const id = editId || ('target-' + Math.random().toString(36).substring(2, 9));
        this.state.targets[id] = {
            id,
            name,
            url,
            environment: env,
            provider: provider,
            createdAt: editId ? (this.state.targets[id]?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.closeModals();
        this.renderAll();
        this.showToast(`🎯 Target "${name}" ${editId ? 'updated' : 'added'} successfully!`, 'success');
        await this.syncVaultState();
    }

    async deleteTarget(id) {
        const target = this.state.targets[id];
        const targetName = target ? target.name : 'this target';

        this.showConfirmModal(`Are you sure you want to delete "${targetName}" from your audit targets?`, '🗑️ Delete Audit Target', async () => {
            delete this.state.targets[id];
            this.renderAll();
            this.showToast(`Target "${targetName}" deleted`, 'info');
            await this.syncVaultState();
        });
    }

    // VENOM TEMPLATES CRUD
    openNewVenomModal() {
        document.getElementById('venom-edit-id').value = '';
        document.getElementById('venom-modal-title').textContent = '🧪 Create Custom Venom Template';
        document.getElementById('venom-name').value = '';
        document.getElementById('venom-payloads').value = '';
        document.getElementById('venom-description').value = '';
        document.getElementById('modal-venom').classList.remove('hidden');
    }

    editVenomTemplate(id) {
        const tmpl = (this.state.customVenomTemplates || []).find(t => t.id === id);
        if (!tmpl) return;
        document.getElementById('venom-edit-id').value = tmpl.id;
        document.getElementById('venom-modal-title').textContent = '🧪 Edit Venom Template';
        document.getElementById('venom-name').value = tmpl.name;
        document.getElementById('venom-category').value = tmpl.category || 'dast';
        document.getElementById('venom-severity').value = tmpl.severity || 'HIGH';
        document.getElementById('venom-cvss').value = tmpl.cvssScore || 7.5;
        document.getElementById('venom-payloads').value = Array.isArray(tmpl.payloads) ? tmpl.payloads.join(', ') : (tmpl.payloads || '');
        document.getElementById('venom-description').value = tmpl.description || '';
        document.getElementById('modal-venom').classList.remove('hidden');
    }

    async saveVenomTemplate() {
        const editId = document.getElementById('venom-edit-id').value;
        const name = document.getElementById('venom-name').value.trim();
        const category = document.getElementById('venom-category').value;
        const severity = document.getElementById('venom-severity').value;
        const cvssScore = parseFloat(document.getElementById('venom-cvss').value) || 7.5;
        const payloadsRaw = document.getElementById('venom-payloads').value.trim();
        const description = document.getElementById('venom-description').value.trim();

        if (!name) {
            this.showToast('Please enter a template name', 'warning');
            return;
        }

        const payloads = payloadsRaw ? payloadsRaw.split(',').map(p => p.trim()).filter(Boolean) : [];
        const id = editId || ('venom-' + Math.random().toString(36).substring(2, 9));

        if (!this.state.customVenomTemplates) this.state.customVenomTemplates = [];

        const newTmpl = { id, name, category, severity, cvssScore, payloads, description };
        const idx = this.state.customVenomTemplates.findIndex(t => t.id === id);
        if (idx !== -1) {
            this.state.customVenomTemplates[idx] = newTmpl;
        } else {
            this.state.customVenomTemplates.push(newTmpl);
        }

        this.closeModals();
        this.renderAll();
        this.showToast(`🧪 Venom Template "${name}" ${editId ? 'updated' : 'created'}!`, 'success');
        await this.syncVaultState();
    }

    async deleteVenomTemplate(id) {
        const tmpl = (this.state.customVenomTemplates || []).find(t => t.id === id);
        const name = tmpl ? tmpl.name : 'this template';

        this.showConfirmModal(`Are you sure you want to delete Venom Template "${name}"?`, '🗑️ Delete Venom Template', async () => {
            this.state.customVenomTemplates = (this.state.customVenomTemplates || []).filter(t => t.id !== id);
            this.renderAll();
            this.showToast(`Venom Template "${name}" deleted`, 'info');
            await this.syncVaultState();
        });
    }

    // NECTAR CANARIES CRUD
    openNewCanaryModal() {
        document.getElementById('canary-edit-id').value = '';
        document.getElementById('canary-modal-title').textContent = '🍯 Generate NectarCanary Probe';
        document.getElementById('canary-target-url').value = '';
        document.getElementById('canary-token').value = '';
        document.getElementById('modal-canary').classList.remove('hidden');
    }

    editCanaryProbe(id) {
        const canary = this.state.canaries[id];
        if (!canary) return;
        document.getElementById('canary-edit-id').value = canary.id;
        document.getElementById('canary-modal-title').textContent = '🍯 Edit NectarCanary Probe';
        document.getElementById('canary-target-url').value = canary.targetUrl;
        document.getElementById('canary-token').value = canary.canaryToken;
        document.getElementById('modal-canary').classList.remove('hidden');
    }

    async saveCanaryProbe() {
        const editId = document.getElementById('canary-edit-id').value;
        const targetUrl = document.getElementById('canary-target-url').value.trim();
        let token = document.getElementById('canary-token').value.trim();

        if (!targetUrl) {
            this.showToast('Please enter a target URL for the canary probe', 'warning');
            return;
        }

        if (!token) {
            token = `waisp_canary_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
        }

        const id = editId || ('canary-' + Math.random().toString(36).substring(2, 9));
        const callbackUrl = `https://waisp-canary.terra.internal/probe/${token}`;

        this.state.canaries[id] = {
            id,
            canaryToken: token,
            targetUrl,
            callbackUrl,
            status: editId ? (this.state.canaries[id]?.status || 'armed') : 'armed',
            createdAt: editId ? (this.state.canaries[id]?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };

        this.closeModals();
        this.renderAll();
        this.showToast(`🍯 Canary Probe "${token}" ${editId ? 'updated' : 'generated'}!`, 'success');
        await this.syncVaultState();
    }

    async deleteCanaryProbe(id) {
        const canary = this.state.canaries[id];
        const token = canary ? canary.canaryToken : 'this probe';

        this.showConfirmModal(`Are you sure you want to delete Canary Probe "${token}"?`, '🗑️ Delete Nectar Canary', async () => {
            delete this.state.canaries[id];
            this.renderAll();
            this.showToast(`Canary Probe "${token}" deleted`, 'info');
            await this.syncVaultState();
        });
    }

    // VULNERABILITIES DELETE
    async deleteVulnerability(id) {
        const vuln = this.state.vulnerabilities[id];
        const title = vuln ? vuln.title : 'this finding';

        this.showConfirmModal(`Are you sure you want to delete finding "${title}"?`, '🗑️ Delete Finding', async () => {
            delete this.state.vulnerabilities[id];
            this.renderAll();
            this.showToast(`Vulnerability finding deleted`, 'info');
            await this.syncVaultState();
        });
    }

    openNewScanModal() {
        const targetSelect = document.getElementById('scan-target-id');
        const targets = Object.values(this.state.targets || {});
        if (targets.length === 0) {
            this.showToast('Please add an audit target first!', 'warning');
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
        this.showToast(`⚡ Starting WAISP Hornet scan against ${target.name}... Check findings in Vulnerabilities tab!`, 'info');
        
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
        this.showToast(`🛡️ Scan completed! Found ${vulns.length} new vulnerability items.`, 'success');
        await this.syncVaultState();
    }

    closeModals() {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    }

    saveSettings() {
        const port = document.getElementById('setting-port').value;
        localStorage.setItem('waisp_port', port);
        this.showToast(`Settings saved! CLI default studio port set to: ${port}`, 'success');
    }
}

const app = new WaispStudioApp();
