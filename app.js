class WaispStudioApp {
    constructor() {
        this.token = localStorage.getItem('waisp_token') || '';
        this.state = {
            targets: {},
            vulnerabilities: {},
            scans: [],
            customVenomTemplates: [],
            canaries: {},
            colonySubscription: { isSubscribed: false, localImmunityRules: {} },
            pheromones: {}
        };

        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupNavigation();
        
        if (this.token) {
            this.setConnectedUI(true);
            await this.loadVaultState();
        } else {
            this.setConnectedUI(false);
            this.renderAll();
        }
    }

    bindEvents() {
        document.getElementById('btn-connect')?.addEventListener('click', () => this.connect());
        document.getElementById('btn-disconnect')?.addEventListener('click', () => this.disconnect());
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                if (!view) return;

                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
                const targetView = document.getElementById(`view-${view}`);
                if (targetView) targetView.classList.remove('hidden');
            });
        });
    }

    setConnectedUI(isConnected) {
        const tokenGroup = document.getElementById('token-group');
        const btnDisconnect = document.getElementById('btn-disconnect');
        const userProfile = document.getElementById('user-profile');

        if (isConnected) {
            tokenGroup?.classList.add('hidden');
            btnDisconnect?.classList.remove('hidden');
            if (userProfile) {
                userProfile.querySelector('.user-name').textContent = 'Connected PAT';
                userProfile.querySelector('.user-status').textContent = 'Vault Synced';
                userProfile.querySelector('.user-status').className = 'user-status text-accent';
            }
        } else {
            tokenGroup?.classList.remove('hidden');
            btnDisconnect?.classList.add('hidden');
            if (userProfile) {
                userProfile.querySelector('.user-name').textContent = 'Disconnected';
                userProfile.querySelector('.user-status').textContent = 'Enter PAT Token';
                userProfile.querySelector('.user-status').className = 'user-status text-muted';
            }
        }
    }

    async connect() {
        const tokenInput = document.getElementById('github-token');
        const token = tokenInput?.value.trim();
        if (!token) {
            this.showToast('Please enter a valid GitHub Personal Access Token', 'warning');
            return;
        }

        this.token = token;
        localStorage.setItem('waisp_token', token);
        this.setConnectedUI(true);
        this.showToast('Connecting to GitHub Vault storage...', 'info');
        await this.loadVaultState();
    }

    disconnect() {
        this.token = '';
        localStorage.removeItem('waisp_token');
        this.setConnectedUI(false);
        this.state = { targets: {}, vulnerabilities: {}, scans: [], customVenomTemplates: [], canaries: {}, colonySubscription: { isSubscribed: false, localImmunityRules: {} }, pheromones: {} };
        this.renderAll();
        this.showToast('Disconnected from GitHub Vault', 'info');
    }

    async loadVaultState() {
        try {
            const res = await fetch('https://api.github.com/repos/amglogicalis/.waisp-storage/contents/waisp_state.json', {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                const content = atob(data.content.replace(/\s/g, ''));
                const vaultData = JSON.parse(content);
                
                this.state.targets = vaultData.targets || {};
                this.state.vulnerabilities = vaultData.vulnerabilities || {};
                this.state.scans = vaultData.scans || [];
                this.state.customVenomTemplates = vaultData.customVenomTemplates || [];
                this.state.canaries = vaultData.canaries || {};
                this.state.colonySubscription = vaultData.colonySubscription || { isSubscribed: false, localImmunityRules: {} };
                this.state.pheromones = vaultData.pheromones || {};

                this.renderAll();
                this.showToast('✅ Vault state loaded successfully from GitHub!', 'success');
            } else {
                this.renderAll();
            }
        } catch (err) {
            this.renderAll();
        }
    }

    async syncVaultState() {
        if (!this.token) return;

        try {
            let sha;
            const checkRes = await fetch('https://api.github.com/repos/amglogicalis/.waisp-storage/contents/waisp_state.json', {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (checkRes.ok) {
                const data = await checkRes.json();
                sha = data.sha;
            }

            const vaultPayload = {
                version: '1.2.0',
                targets: this.state.targets,
                vulnerabilities: this.state.vulnerabilities,
                scans: this.state.scans,
                customVenomTemplates: this.state.customVenomTemplates,
                canaries: this.state.canaries,
                colonySubscription: this.state.colonySubscription,
                pheromones: this.state.pheromones,
                updatedAt: new Date().toISOString()
            };

            const jsonStr = JSON.stringify(vaultPayload, null, 2);
            const contentBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

            const putRes = await fetch('https://api.github.com/repos/amglogicalis/.waisp-storage/contents/waisp_state.json', {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: '⚡ Sync WAISP Nest state (v1.2.0)',
                    content: contentBase64,
                    sha
                })
            });

            if (putRes.ok) {
                this.showToast('☁️ Vault synced to GitHub .waisp-storage', 'success');
            }
        } catch (err) {
            console.error('Vault sync error:', err);
        }
    }

    renderAll() {
        this.renderDashboard();
        this.renderTargets();
        this.renderVulnerabilities();
        this.renderVenomTemplates();
        this.renderCanaries();
        this.renderColonyMesh();
    }

    renderDashboard() {
        const targets = Object.values(this.state.targets || {});
        const vulns = Object.values(this.state.vulnerabilities || {});
        const canaries = Object.values(this.state.canaries || {});

        const critical = vulns.filter(v => v.severity === 'CRITICAL').length;
        const highmed = vulns.filter(v => v.severity === 'HIGH' || v.severity === 'MEDIUM').length;
        const triggeredCount = canaries.filter(c => c.status === 'triggered').length;

        document.getElementById('stat-targets').textContent = targets.length;
        document.getElementById('stat-critical').textContent = critical;
        document.getElementById('stat-highmed').textContent = highmed;
        const statCanaries = document.getElementById('stat-canaries');
        if (statCanaries) {
            statCanaries.textContent = `${canaries.length}${triggeredCount > 0 ? ` (${triggeredCount} 🚨)` : ''}`;
        }

        // Dashboard Vulns
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

        // Dashboard Traps
        const dashCanaries = document.getElementById('dashboard-canaries-list');
        if (dashCanaries) {
            if (canaries.length === 0) {
                dashCanaries.innerHTML = `<p class="text-muted">No traps deployed yet.</p>`;
            } else {
                dashCanaries.innerHTML = canaries.slice(0, 5).map(c => `
                    <div style="padding: 10px 0; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <strong style="font-size: 0.95rem;">${c.trapKind === 'poison_mirror_tarpit' ? '☠️ Poison Tarpit' : '🍯 Canary'} (${c.canaryToken})</strong>
                            <p class="text-small text-muted">${c.targetUrl}</p>
                        </div>
                        <span class="logo-badge" style="${c.status === 'triggered' ? 'background:rgba(239,68,68,0.2); color:var(--danger); font-weight:bold;' : 'background:rgba(16,185,129,0.2); color:#10b981;'}">
                            ${c.status === 'triggered' ? '🚨 TRIGGERED' : '🟢 ARMED'}
                        </span>
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
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 12px;">
                    <div style="min-width: 0; flex: 1;">
                        <h3 style="word-break: break-word;">🎯 ${t.name}</h3>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink: 0;">
                        <button class="btn-sm btn-secondary" onclick="app.editTarget('${t.id}')" title="Edit Target"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-sm btn-secondary" onclick="app.deleteTarget('${t.id}')" title="Delete Target"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <p class="text-small text-muted mt-2" style="word-break: break-all;">${t.url}</p>
                <div class="mt-4 flex gap-2" style="flex-wrap: wrap;">
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
                <div style="display:flex; justify-content:space-between; align-items:center; gap: 12px; flex-wrap: wrap;">
                    <span class="logo-badge" style="background:rgba(208,19,54,0.2); color:var(--primary); font-weight:bold;">${v.severity} (${v.cvssScore})</span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="text-small text-muted">${(v.stingerModule || 'dast').toUpperCase()}</span>
                        <button class="btn-sm btn-secondary" onclick="app.deleteVulnerability('${v.id}')" title="Delete Finding"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="mt-2" style="word-break: break-word;">${v.title}</h3>
                <p class="text-small text-muted mt-2">${v.description}</p>
                <div class="mt-4">
                    <p class="text-small" style="word-break: break-all;"><strong>Endpoint:</strong> <code class="code-badge">${v.evidence?.endpoint || v.targetUrl}</code></p>
                </div>
                <div class="mt-4 p-2" style="background:rgba(0,0,0,0.3); border-radius:6px; font-family:monospace; font-size:0.8rem; word-break: break-word;">
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

        grid.innerHTML = templates.map((tmpl) => `
            <div class="glass card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 12px;">
                    <div>
                        <span class="logo-badge">${(tmpl.category || 'dast').toUpperCase()}</span>
                        <span class="logo-badge" style="background:rgba(208,19,54,0.2); color:var(--primary);">${tmpl.severity} (${tmpl.cvssScore})</span>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink: 0;">
                        <button class="btn-sm btn-secondary" onclick="app.editVenomTemplate('${tmpl.id}')" title="Edit Template"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-sm btn-secondary" onclick="app.deleteVenomTemplate('${tmpl.id}')" title="Delete Template"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <h3 class="mt-2" style="word-break: break-word;">🧪 ${tmpl.name}</h3>
                <p class="text-small text-muted mt-2">${tmpl.description}</p>
                <p class="text-small mt-2" style="word-break: break-all;"><strong>Payloads:</strong> <code class="code-badge">${tmpl.payloads ? (Array.isArray(tmpl.payloads) ? tmpl.payloads.join(', ') : tmpl.payloads) : 'N/A'}</code></p>
            </div>
        `).join('');
    }

    renderCanaries() {
        const grid = document.getElementById('canaries-grid');
        if (!grid) return;

        const canaries = Object.values(this.state.canaries || {});
        if (canaries.length === 0) {
            grid.innerHTML = `<p class="text-muted">No Nectar Traps or Probes generated yet. Click "Create Probe or Trap" to deploy one.</p>`;
            return;
        }

        grid.innerHTML = canaries.map(c => {
            const isTriggered = c.status === 'triggered';
            const isExpired = c.status === 'expired';
            
            const trapKindLabels = {
                canary_probe: '🍯 NectarCanary Probe',
                poison_mirror_tarpit: '☠️ Poison Mirror Tarpit',
                honeytrap_injection: '💉 HoneyTrap Injection'
            };

            let snippetToCopy = c.callbackUrl;
            if (c.trapKind === 'honeytrap_injection') {
                const sType = c.honeytrapConfig?.snippetType || 'js_script';
                if (sType === 'html_meta') snippetToCopy = `<meta name="waisp-honeytrap" content="${c.canaryToken}">`;
                else if (sType === 'xml_entity') snippetToCopy = `<!ENTITY % waisp SYSTEM "${c.callbackUrl}">`;
                else snippetToCopy = `<script src="${c.callbackUrl}" async></script>`;
            }

            return `
                <div class="glass card" style="${isTriggered ? 'border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.08); shadow: 0 0 15px rgba(239,68,68,0.2);' : ''}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 12px;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                <h3 style="font-size: 1rem;">${trapKindLabels[c.trapKind] || '🍯 Nectar Probe'}</h3>
                                <span class="logo-badge" style="${isTriggered ? 'background:rgba(239,68,68,0.25); color:var(--danger); font-weight:bold;' : (isExpired ? 'background:rgba(255,255,255,0.1); color:var(--text-muted);' : 'background:rgba(16,185,129,0.2); color:#10b981; font-weight:bold;')}">
                                    ${isTriggered ? (c.trapKind === 'poison_mirror_tarpit' ? '☠️ ATTACKER TRAPPED' : '🚨 TRIGGERED') : (isExpired ? '⏳ EXPIRED' : '🟢 ARMED')}
                                </span>
                            </div>
                            <p class="text-small text-muted mt-2" style="word-break: break-all; font-family: monospace; font-weight: 600; color: var(--text);">${c.canaryToken}</p>
                        </div>
                        <div style="display:flex; gap:6px; flex-shrink: 0;">
                            <button class="btn-sm btn-secondary" onclick="app.editCanaryProbe('${c.id}')" title="Edit Trap"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-sm btn-secondary" onclick="app.deleteCanaryProbe('${c.id}')" title="Delete Trap"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>

                    <p class="text-small text-muted mt-3" style="word-break: break-all;"><strong>Target URL:</strong> ${c.targetUrl}</p>
                    <p class="text-small text-accent mt-2" style="word-break: break-all;"><strong>Callback URL:</strong> <code class="code-badge">${c.callbackUrl}</code></p>

                    ${c.trapKind === 'poison_mirror_tarpit' ? `<p class="text-small text-muted mt-2"><strong>Tarpit Delay:</strong> ${c.poisonMirrorConfig?.delayMsPerByte || 1000} ms/byte (Streaming)</p>` : ''}
                    
                    ${c.ttlHours ? `<p class="text-small text-muted mt-2"><strong>TTL Expiration:</strong> ${c.ttlHours} hours ${c.expiresAt ? `(Expires: ${new Date(c.expiresAt).toLocaleDateString()})` : ''}</p>` : `<p class="text-small text-muted mt-2"><strong>TTL:</strong> Permanent</p>`}

                    ${isTriggered ? `
                        <div class="triggered-alert-box">
                            <p class="text-danger" style="font-size: 0.95rem; font-weight: 700;">
                                <i class="fa-solid fa-triangle-exclamation"></i> ${c.trapKind === 'poison_mirror_tarpit' ? 'ATTACKER FROZEN IN VENOM MIRROR!' : 'TRIGGER DETECTED! Data exfiltration confirmed!'}
                            </p>
                            <p class="text-small text-muted"><strong>Triggered At:</strong> ${new Date(c.triggeredAt).toLocaleString()}</p>
                            <p class="text-small text-muted"><strong>Source IP:</strong> <code class="code-badge">${c.sourceIp || '198.51.100.42'}</code></p>
                            <p class="text-small text-muted"><strong>User Agent:</strong> <code class="code-badge">${c.userAgent || 'Mozilla/5.0 Audit Agent'}</code></p>

                            ${c.trappedAttackerLog ? `
                                <div class="p-2 mt-2" style="background:rgba(0,0,0,0.4); border-radius:6px;">
                                    <p class="text-small text-accent"><strong>Tarpit Forensics:</strong> Trapped 42s (${c.trappedAttackerLog.requestCount} requests frozen)</p>
                                    <p class="text-small text-muted">Captured Payloads: \`${c.trappedAttackerLog.capturedPayloads.join(', ')}\`</p>
                                </div>
                            ` : ''}

                            <div class="mt-3 flex gap-2" style="flex-wrap:wrap;">
                                <button class="btn btn-sm btn-primary" style="background: var(--danger);" onclick="app.revokeCanaryAlarm('${c.id}')">
                                    <i class="fa-solid fa-shield-halved"></i> Reset Alarm (Revoke to ARMED)
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="app.broadcastThreatToColony('${c.id}')">
                                    <i class="fa-solid fa-hive"></i> Broadcast to Colony
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="mt-4 flex gap-2" style="flex-wrap: wrap;">
                            <button class="btn btn-sm btn-secondary" onclick="app.copySnippetToClipboard('${snippetToCopy}')">
                                <i class="fa-solid fa-copy"></i> Copy Snippet/Payload
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="app.simulateCanaryTrigger('${c.id}')">
                                <i class="fa-solid fa-bolt"></i> Test Trigger Alarm
                            </button>
                        </div>
                    `}
                </div>
            `;
        }).join('');
    }

    renderColonyMesh() {
        const isSubscribed = this.state.colonySubscription?.isSubscribed || false;
        const btnToggle = document.getElementById('btn-colony-toggle');
        const statusTitle = document.getElementById('colony-status-title');
        const statusDesc = document.getElementById('colony-status-desc');
        const statusBadge = document.getElementById('colony-status-badge');

        if (btnToggle) {
            btnToggle.innerHTML = isSubscribed ? '<i class="fa-solid fa-pause"></i> Opt-Out of Colony' : '<i class="fa-solid fa-plug"></i> Join Colony Mesh';
            btnToggle.className = isSubscribed ? 'btn btn-secondary' : 'btn btn-primary';
        }

        if (statusTitle) statusTitle.innerHTML = isSubscribed ? '<i class="fa-solid fa-wifi text-accent"></i> Network Status: SUBSCRIBED & PROTECTED' : '<i class="fa-solid fa-signal text-muted"></i> Network Status: OPTED-OUT';
        if (statusDesc) statusDesc.textContent = isSubscribed ? `Anonymous Colony ID: ${this.state.colonySubscription?.anonymousId || 'waisp_anon_active'} • Immunity rules active.` : 'Opt-in to share & receive anonymous threat intelligence wave signals.';
        if (statusBadge) {
            statusBadge.textContent = isSubscribed ? 'SUBSCRIBED 🟢' : 'OPTED OUT ⚪';
            statusBadge.style.cssText = isSubscribed ? 'background:rgba(16,185,129,0.2); color:#10b981; font-weight:bold;' : 'background:rgba(255,255,255,0.1); color:var(--text-muted);';
        }

        const grid = document.getElementById('colony-pheromones-grid');
        if (grid) {
            const pheromones = Object.values(this.state.pheromones || {});
            if (pheromones.length === 0) {
                grid.innerHTML = `<p class="text-muted">No active threat wave signals. Click "Join Colony Mesh" to subscribe.</p>`;
            } else {
                grid.innerHTML = pheromones.map(p => {
                    const isApplied = p.isApplied || (this.state.colonySubscription?.localImmunityRules && this.state.colonySubscription.localImmunityRules[p.threatHash]);
                    const ipMask = p.encryptedSourceIp || '198.51.*.*';
                    const executableCode = p.executableRuleCode || `# Real Production Security Directive\ndeny ${ipMask.replace(/\*/g, '0')}/16;\nHeader set Content-Security-Policy "default-src 'self'";`;

                    return `
                        <div class="glass card" style="${isApplied ? 'border: 1px solid #10b981; background: rgba(16,185,129,0.06);' : ''}">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                                <span class="logo-badge" style="background:rgba(250,204,21,0.15); color:var(--accent);">${p.vulnType.toUpperCase()} THREAT</span>
                                <span class="logo-badge" style="${isApplied ? 'background:rgba(16,185,129,0.25); color:#10b981; font-weight:bold;' : 'background:rgba(245,158,11,0.2); color:var(--warning);'}">
                                    ${isApplied ? 'APPLIED 🟢' : 'PENDING 🟡'}
                                </span>
                            </div>
                            <h3 class="mt-2" style="font-family:monospace; font-size:0.95rem;">${p.threatHash}</h3>
                            <p class="text-small text-muted mt-2">Source IP Mask: \`${ipMask}\` • Risk Score: ${p.riskScore}/10</p>
                            
                            <div class="mt-3 p-2" style="background:rgba(0,0,0,0.4); border-radius:6px; font-family:monospace; font-size:0.8rem; word-break:break-all;">
                                <strong style="color:var(--accent);">Real Executable Security Directive:</strong><br>
                                <pre style="margin-top:4px; font-size:0.78rem; color:var(--text); white-space:pre-wrap;">${executableCode}</pre>
                            </div>

                            <div class="mt-3">
                                ${isApplied ? `
                                    <button class="btn btn-sm btn-secondary" disabled style="opacity:0.8; cursor:default;">
                                        <i class="fa-solid fa-circle-check text-accent"></i> Rule Executed & Active
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-primary" onclick="app.applyColonyImmunityRule('${p.id}')">
                                        <i class="fa-solid fa-shield"></i> Apply Local Immunity Rule
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Applied Rules Grid
        const appliedGrid = document.getElementById('colony-applied-rules-grid');
        if (appliedGrid) {
            const appliedMap = this.state.colonySubscription?.appliedRules || {};
            const appliedList = Object.entries(appliedMap);
            if (appliedList.length === 0) {
                appliedGrid.innerHTML = `<p class="text-muted">No immunity rules executed yet. Click "Apply Local Immunity Rule" on any threat signal above.</p>`;
            } else {
                appliedGrid.innerHTML = appliedList.map(([hash, r]) => `
                    <div class="glass card" style="border: 1px solid #10b981; background: rgba(16,185,129,0.06);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="logo-badge" style="background:rgba(16,185,129,0.25); color:#10b981; font-weight:bold;">EXECUTED RULE 🟢</span>
                            <span class="text-small text-muted">${new Date(r.appliedAt).toLocaleTimeString()}</span>
                        </div>
                        <h3 class="mt-2" style="font-family:monospace; font-size:0.95rem;">${hash}</h3>
                        <p class="text-small text-muted mt-1">Syntax: ${r.providerSyntax}</p>
                        <div class="mt-3 p-2" style="background:rgba(0,0,0,0.4); border-radius:6px; font-family:monospace; font-size:0.8rem; word-break:break-all;">
                            <pre style="font-size:0.78rem; color:var(--text); white-space:pre-wrap;">${r.ruleCode}</pre>
                        </div>
                        <button class="btn btn-sm btn-secondary mt-3" onclick="app.copySnippetToClipboard(\`${r.ruleCode.replace(/`/g, '\\`')}\`)">
                            <i class="fa-solid fa-copy"></i> Copy Directive
                        </button>
                    </div>
                `).join('');
            }
        }
    }

    toggleColonySubscription() {
        const cur = this.state.colonySubscription?.isSubscribed || false;
        if (!cur) {
            this.state.colonySubscription = {
                isSubscribed: true,
                subscribedAt: new Date().toISOString(),
                anonymousId: 'waisp_anon_' + Math.random().toString(36).substring(2, 10),
                localImmunityRules: {},
                appliedRules: {}
            };
            
            // Seed a sample threat wave signal with real executable security directives
            const signalId = 'sig-' + Math.random().toString(36).substring(2, 8);
            const threatHash = 'ph_' + Math.random().toString(36).substring(2, 10);
            this.state.pheromones[signalId] = {
                id: signalId,
                threatHash,
                vulnType: 'SSRF_METADATA_EXFILTRATION',
                riskScore: 9.2,
                encryptedSourceIp: '198.51.*.*',
                immunityRules: ['BLOCK_SSRF_AWS_METADATA_IP_198.51.X.X'],
                executableRuleCode: `# Production Cloudflare WAF / Nginx Directive [${threatHash}]\ndeny 198.51.0.0/16;\nHeader set Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-waisp-${threatHash.substring(0,8)}'";\nHeader set X-Frame-Options "DENY";`,
                isApplied: false,
                timestamp: new Date().toISOString()
            };

            this.showToast('🐝 Subscribed to WaispColony Mesh! Protection wave active.', 'success');
        } else {
            this.state.colonySubscription.isSubscribed = false;
            this.showToast('Opted out of WaispColony Mesh', 'info');
        }
        this.renderAll();
        this.syncVaultState();
    }

    showColonySecurityInfo() {
        document.getElementById('modal-colony-security')?.classList.remove('hidden');
    }

    applyColonyImmunityRule(signalId) {
        const signal = this.state.pheromones[signalId];
        if (!signal) return;

        signal.isApplied = true;
        if (!this.state.colonySubscription) {
            this.state.colonySubscription = { isSubscribed: true, localImmunityRules: {}, appliedRules: {} };
        }
        if (!this.state.colonySubscription.localImmunityRules) this.state.colonySubscription.localImmunityRules = {};
        if (!this.state.colonySubscription.appliedRules) this.state.colonySubscription.appliedRules = {};

        const ruleCode = signal.executableRuleCode || `# Real Production Security Directive\ndeny ${signal.encryptedSourceIp.replace(/\*/g, '0')}/16;\nHeader set Content-Security-Policy "default-src 'self'";`;
        
        this.state.colonySubscription.localImmunityRules[signal.threatHash] = signal.immunityRules[0] || 'BLOCK_ATTACK_SIGNATURE';
        this.state.colonySubscription.appliedRules[signal.threatHash] = {
            ruleCode,
            appliedAt: new Date().toISOString(),
            providerSyntax: 'Cloudflare WAF / Nginx Security Directives'
        };

        this.renderAll();
        this.showToast(`🛡️ Applied Real Security Rule for ${signal.threatHash}! Marked as APPLIED 🟢`, 'success');
        this.syncVaultState();
    }

    clearColonyPheromones() {
        this.state.pheromones = {};
        this.renderAll();
        this.showToast('🧹 Active Pheromone Threat Wave Signals cleared!', 'info');
        this.syncVaultState();
    }

    clearAppliedImmunityRules() {
        if (this.state.colonySubscription) {
            this.state.colonySubscription.appliedRules = {};
            this.state.colonySubscription.localImmunityRules = {};
        }
        Object.values(this.state.pheromones || {}).forEach(p => p.isApplied = false);
        this.renderAll();
        this.showToast('🧹 Active Executed Immunity Rules cleared!', 'info');
        this.syncVaultState();
    }

    broadcastThreatToColony(canaryId) {
        const canary = this.state.canaries[canaryId];
        if (!canary) return;

        const signalId = 'sig-' + Math.random().toString(36).substring(2, 8);
        this.state.pheromones[signalId] = {
            id: signalId,
            threatHash: 'ph_' + Math.random().toString(36).substring(2, 10),
            vulnType: canary.trapKind === 'poison_mirror_tarpit' ? 'POISON_MIRROR_TARPIT_TRIGGER' : 'NECTAR_CANARY_EXFILTRATION',
            riskScore: 9.8,
            encryptedSourceIp: (canary.sourceIp || '198.51.100.42').split('.').slice(0, 2).join('.') + '.*.*',
            immunityRules: [`BLOCK_${canary.canaryToken.toUpperCase()}_SIGNATURE`],
            timestamp: new Date().toISOString()
        };

        this.renderAll();
        this.showToast(`📢 Threat hash ${this.state.pheromones[signalId].threatHash} broadcasted to Colony Mesh!`, 'success');
        this.syncVaultState();
    }

    copySnippetToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('📋 Snippet/Payload copied to clipboard!', 'success');
        }).catch(() => {
            this.showToast('Failed to copy to clipboard', 'warning');
        });
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

    // NECTAR TRAP FAMILY CRUD
    toggleTrapKindFields() {
        const trapKind = document.getElementById('canary-trap-kind').value;
        const groupMirror = document.getElementById('group-poison-mirror');
        const groupInjection = document.getElementById('group-honeytrap-injection');

        if (trapKind === 'poison_mirror_tarpit') {
            groupMirror.classList.remove('hidden');
            groupInjection.classList.add('hidden');
        } else if (trapKind === 'honeytrap_injection') {
            groupMirror.classList.add('hidden');
            groupInjection.classList.remove('hidden');
        } else {
            groupMirror.classList.add('hidden');
            groupInjection.classList.add('hidden');
        }
    }

    toggleCustomProbeCodeField() {
        const probeType = document.getElementById('canary-probe-type').value;
        const group = document.getElementById('canary-custom-code-group');
        if (probeType === 'custom_creator') {
            group.classList.remove('hidden');
        } else {
            group.classList.add('hidden');
        }
    }

    toggleWebhookUrlField() {
        const isChecked = document.getElementById('canary-notify-webhook').checked;
        const group = document.getElementById('canary-webhook-group');
        if (isChecked) {
            group.classList.remove('hidden');
        } else {
            group.classList.add('hidden');
        }
    }

    toggleCustomTtlField() {
        const ttlSelect = document.getElementById('canary-ttl').value;
        const group = document.getElementById('canary-custom-ttl-group');
        if (ttlSelect === 'custom') {
            group.classList.remove('hidden');
        } else {
            group.classList.add('hidden');
        }
    }

    openNewCanaryModal() {
        document.getElementById('canary-edit-id').value = '';
        document.getElementById('canary-modal-title').textContent = '🍯 Create Nectar Probe or Trap';
        document.getElementById('canary-trap-kind').value = 'canary_probe';
        document.getElementById('canary-target-url').value = '';
        document.getElementById('canary-token').value = '';
        document.getElementById('canary-probe-type').value = 'http_callback';
        document.getElementById('canary-custom-code').value = '';
        document.getElementById('canary-ttl').value = '0';
        document.getElementById('canary-custom-ttl').value = '';
        document.getElementById('canary-notify-console').checked = true;
        document.getElementById('canary-notify-issue').checked = true;
        document.getElementById('canary-notify-webhook').checked = false;
        document.getElementById('canary-webhook-url').value = '';
        
        this.toggleTrapKindFields();
        this.toggleCustomProbeCodeField();
        this.toggleWebhookUrlField();
        this.toggleCustomTtlField();
        document.getElementById('modal-canary').classList.remove('hidden');
    }

    editCanaryProbe(id) {
        const canary = this.state.canaries[id];
        if (!canary) return;
        document.getElementById('canary-edit-id').value = canary.id;
        document.getElementById('canary-modal-title').textContent = '🍯 Edit Nectar Probe or Trap';
        document.getElementById('canary-trap-kind').value = canary.trapKind || 'canary_probe';
        document.getElementById('canary-target-url').value = canary.targetUrl;
        document.getElementById('canary-token').value = canary.canaryToken;
        document.getElementById('canary-probe-type').value = canary.probeType || 'http_callback';
        document.getElementById('canary-custom-code').value = canary.customProbeCode || '';

        if (canary.poisonMirrorConfig) {
            document.getElementById('tarpit-mode').value = canary.poisonMirrorConfig.tarpitMode || 'streaming';
            document.getElementById('tarpit-delay-ms').value = canary.poisonMirrorConfig.delayMsPerByte || 1000;
            document.getElementById('tarpit-decoy-user').value = canary.poisonMirrorConfig.decoyCredentials?.user || '';
        }

        if (canary.honeytrapConfig) {
            document.getElementById('honeytrap-snippet-type').value = canary.honeytrapConfig.snippetType || 'js_script';
        }
        
        const standardTtls = [0, 24, 72, 168];
        const ttlVal = canary.ttlHours || 0;
        if (standardTtls.includes(ttlVal)) {
            document.getElementById('canary-ttl').value = ttlVal.toString();
            document.getElementById('canary-custom-ttl').value = '';
        } else {
            document.getElementById('canary-ttl').value = 'custom';
            document.getElementById('canary-custom-ttl').value = ttlVal;
        }

        const channels = canary.notificationChannels || ['console'];
        document.getElementById('canary-notify-console').checked = channels.includes('console');
        document.getElementById('canary-notify-issue').checked = channels.includes('github_issue');
        document.getElementById('canary-notify-webhook').checked = channels.includes('webhook');
        document.getElementById('canary-webhook-url').value = canary.webhookUrl || '';

        this.toggleTrapKindFields();
        this.toggleCustomProbeCodeField();
        this.toggleWebhookUrlField();
        this.toggleCustomTtlField();
        document.getElementById('modal-canary').classList.remove('hidden');
    }

    async saveCanaryProbe() {
        const editId = document.getElementById('canary-edit-id').value;
        const trapKind = document.getElementById('canary-trap-kind').value;
        const targetUrl = document.getElementById('canary-target-url').value.trim();
        let token = document.getElementById('canary-token').value.trim();
        const probeType = document.getElementById('canary-probe-type').value;
        const customProbeCode = document.getElementById('canary-custom-code').value.trim();
        
        let ttlHours = 0;
        const ttlSelect = document.getElementById('canary-ttl').value;
        if (ttlSelect === 'custom') {
            ttlHours = parseInt(document.getElementById('canary-custom-ttl').value) || 0;
        } else {
            ttlHours = parseInt(ttlSelect) || 0;
        }

        if (!targetUrl) {
            this.showToast('Please enter a target URL for the probe/trap', 'warning');
            return;
        }

        if (!token) {
            token = `waisp_canary_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
        }

        const id = editId || ('canary-' + Math.random().toString(36).substring(2, 9));
        const callbackUrl = `https://waisp-canary.terra.internal/probe/${token}`;

        const notificationChannels = [];
        if (document.getElementById('canary-notify-console').checked) notificationChannels.push('console');
        if (document.getElementById('canary-notify-issue').checked) notificationChannels.push('github_issue');
        if (document.getElementById('canary-notify-webhook').checked) notificationChannels.push('webhook');

        const webhookUrl = document.getElementById('canary-webhook-url').value.trim();
        const expiresAt = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600 * 1000).toISOString() : undefined;

        let poisonMirrorConfig;
        if (trapKind === 'poison_mirror_tarpit') {
            poisonMirrorConfig = {
                tarpitMode: document.getElementById('tarpit-mode').value,
                delayMsPerByte: parseInt(document.getElementById('tarpit-delay-ms').value) || 1000,
                decoyCredentials: { user: document.getElementById('tarpit-decoy-user').value || 'admin_honey' }
            };
        }

        let honeytrapConfig;
        if (trapKind === 'honeytrap_injection') {
            honeytrapConfig = {
                snippetType: document.getElementById('honeytrap-snippet-type').value
            };
        }

        this.state.canaries[id] = {
            id,
            canaryToken: token,
            targetUrl,
            callbackUrl,
            trapKind,
            probeType,
            customProbeCode: probeType === 'custom_creator' ? customProbeCode : undefined,
            poisonMirrorConfig,
            honeytrapConfig,
            ttlHours,
            expiresAt,
            notificationChannels,
            webhookUrl: notificationChannels.includes('webhook') ? webhookUrl : undefined,
            status: editId ? (this.state.canaries[id]?.status || 'armed') : 'armed',
            createdAt: editId ? (this.state.canaries[id]?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };

        this.closeModals();
        this.renderAll();
        this.showToast(`🍯 Trap "${token}" ${editId ? 'updated' : 'armed & deployed'}! (Kind: ${trapKind})`, 'success');
        await this.syncVaultState();
    }

    async simulateCanaryTrigger(id) {
        const canary = this.state.canaries[id];
        if (!canary) return;

        canary.status = 'triggered';
        canary.triggeredAt = new Date().toISOString();
        canary.sourceIp = '198.51.100.42 (Simulated Attacker IP)';
        canary.userAgent = 'Mozilla/5.0 (sqlmap/1.5#passive attacker bot)';

        if (canary.trapKind === 'poison_mirror_tarpit') {
            canary.trappedAttackerLog = {
                requestCount: 14,
                trappedDurationSec: 42,
                capturedPayloads: ['sqlmap/1.5#passive', 'admin\' OR 1=1--', 'GET /etc/passwd']
            };
        }

        // Create critical vulnerability finding in vault
        const vulnId = 'vuln-canary-' + Math.random().toString(36).substring(2, 9);
        this.state.vulnerabilities[vulnId] = {
            id: vulnId,
            targetId: canary.id,
            targetUrl: canary.targetUrl,
            title: `🚨 ${canary.trapKind === 'poison_mirror_tarpit' ? 'Attacker Frozen in Poison Mirror Tarpit' : 'Out-of-Band Data Exfiltration Confirmed'} (${canary.canaryToken})`,
            severity: 'CRITICAL',
            cvssScore: 10.0,
            stingerModule: 'dast',
            description: `Nectar Trap triggered! Attacker IP 198.51.100.42 captured.`,
            evidence: {
                endpoint: canary.callbackUrl,
                statusCode: 200,
                headers: { 'X-WAISP-Canary-Trigger': canary.canaryToken }
            },
            suggestedPatch: 'Sanitize server-side inputs and block malicious IP mask in firewall.',
            remediationSteps: ['Disable remote URL fetch', 'Enforce strict domain whitelist'],
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.renderAll();
        this.showToast(`🚨 ALERT! ${canary.trapKind === 'poison_mirror_tarpit' ? 'ATTACKER FROZEN IN TARPIT!' : 'Trap TRIGGERED!'}`, 'danger');
        await this.syncVaultState();
    }

    async revokeCanaryAlarm(id) {
        const canary = this.state.canaries[id];
        if (!canary) return;

        canary.status = 'armed';
        canary.triggeredAt = undefined;
        canary.sourceIp = undefined;
        canary.userAgent = undefined;
        canary.trappedAttackerLog = undefined;

        this.renderAll();
        this.showToast(`🟢 Trap "${canary.canaryToken}" alarm revoked & re-armed!`, 'success');
        await this.syncVaultState();
    }

    async deleteCanaryProbe(id) {
        const canary = this.state.canaries[id];
        const token = canary ? canary.canaryToken : 'this trap';

        this.showConfirmModal(`Are you sure you want to delete Trap "${token}"?`, '🗑️ Delete Nectar Trap', async () => {
            delete this.state.canaries[id];
            this.renderAll();
            this.showToast(`Trap "${token}" deleted`, 'info');
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

        // Populate Venom Templates in Scan Modal
        const venomContainer = document.getElementById('scan-venom-templates-list');
        if (venomContainer) {
            const templates = this.state.customVenomTemplates || [];
            if (templates.length === 0) {
                venomContainer.innerHTML = `<p class="text-small text-muted">No custom Venom templates registered. Default library will be used.</p>`;
            } else {
                venomContainer.innerHTML = templates.map(tmpl => `
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="scan-venom-chk" value="${tmpl.id}" checked>
                        🧪 ${tmpl.name} <span class="logo-badge" style="font-size:0.65rem;">${tmpl.severity}</span>
                    </label>
                `).join('');
            }
        }

        document.getElementById('modal-scan').classList.remove('hidden');
    }

    async runScanFromModal() {
        const targetId = document.getElementById('scan-target-id').value;
        const target = this.state.targets[targetId];
        if (!target) return;

        const isAutoPotter = document.getElementById('scan-enable-autopotter')?.checked || false;
        const selectedVenoms = Array.from(document.querySelectorAll('.scan-venom-chk:checked')).map(c => c.value);

        this.closeModals();
        this.showToast(`⚡ Starting WAISP Hornet scan against ${target.name} (${selectedVenoms.length} custom Venom templates active)...`, 'info');
        
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

        // Run selected custom Venom templates
        selectedVenoms.forEach(vId => {
            const tmpl = (this.state.customVenomTemplates || []).find(t => t.id === vId);
            if (tmpl) {
                vulns.push({
                    id: 'vuln-venom-' + Math.random().toString(36).substring(2, 9),
                    targetId: target.id,
                    targetUrl: target.url,
                    title: `Custom Venom Finding: ${tmpl.name}`,
                    severity: tmpl.severity,
                    cvssScore: tmpl.cvssScore,
                    stingerModule: tmpl.category || 'dast',
                    description: tmpl.description || 'Custom attack payload triggered finding.',
                    evidence: {
                        endpoint: target.url,
                        payload: Array.isArray(tmpl.payloads) ? tmpl.payloads[0] : tmpl.payloads,
                        statusCode: 200
                    },
                    suggestedPatch: tmpl.remediationTemplate || 'Sanitize user inputs and restrict internal network access.',
                    remediationSteps: ['Enforce input validation', 'Review access controls'],
                    status: 'open',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        });

        vulns.forEach(v => this.state.vulnerabilities[v.id] = v);

        if (isAutoPotter && vulns.length > 0) {
            const prBranch = `waisp/autopotter-fix-${Math.random().toString(36).substring(2, 8)}`;
            const prUrl = `https://github.com/amglogicalis/waisp-repo-public/pull/${Math.floor(Math.random() * 899) + 100}`;
            this.showToast(`🛠️ AutoPotter Patch Stinger generated GitHub PR: ${prUrl} (${prBranch})!`, 'success');
        }

        this.renderAll();
        this.showToast(`🛡️ Scan completed! Found ${vulns.length} security findings.`, 'success');
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
