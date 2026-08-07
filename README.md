# 🛡️ WAISP — Web Automated Inspection & Security Penetration

> **Terra Ecosystem DAST & Red Teaming Engine — $0 Infrastructure Security**

**WAISP** es el titán de **Pentesting Automatizado, DAST (Dynamic Application Security Testing) y Red Teaming** del Ecosistema Terra.

---

## 🐝 Nomenclatura & Módulos de la Colonia

- **🪹 HornetVault**: Persistencia inmutable en `.waisp-storage` (almacena objetivos, matriz CVSS v3.1 y hallazgos).
- **🗡️ StingerEngines**: Motores de auditoría ofensiva y vectores de penetración:
  - `Stinger-ReconShield`: Inspección SSL/TLS, fingerprint de WAF (Cloudflare, AWS WAF, Akamai, Formica Soldiers) y cabeceras de seguridad (HSTS, CSP, X-Frame-Options).
  - `Stinger-DastFuzzer`: Fuzzing dinámico XSS, SQLi, CORS misconfigurations, Open Redirects y CSRF.
  - `Stinger-ApiInspector`: Auditoría OpenAPI/Swagger, IDOR/BOLA y rotura de autenticación REST/GraphQL.
  - `Stinger-RuntimeLeaks`: Fugas en vivo de tokens JWT, variables globales DOM y claves de AWS/GitHub en cliente.
- **🧪 VenomPayloads**: Biblioteca de plantillas de ataque y diccionarios personalizables.
- **🍯 NectarCanary**: Sondas de penetración activa y callbacks para verificar exfiltración de datos con 0% de falsos positivos.
- **🛡️ Hivuard**: Motor de triaje de vulnerabilidades, cálculo CVSS v3.1, generación de PoC y creador de **GitHub Issues** con parches sugeridos.
- **🐝 SwarmRunner**: Orquestador de escaneo masivo paralelo sobre GitHub Actions ($0).
- **🎛️ WAISP Nest Studio**: Consola web Dark Glassmorphic 24/7 en GitHub Pages.

---

## 🛠️ Instalación y CLI

```bash
npm install -g waisp
# o ejecutar directamente:
npx waisp <comando>
```

### 🚀 Comandos

```bash
# 1. Escaneo completo de seguridad
npx waisp scan https://mi-app.com --issues

# 2. Escaneo específico de reconocimiento o DAST
npx waisp recon https://mi-app.com
npx waisp dast https://mi-app.com

# 3. Gestión editable de objetivos (Targets)
npx waisp target add https://mi-app.com --name "App Producción" --env prod --provider aws
npx waisp target list
npx waisp target edit <id> --name "Nuevo Nombre"
npx waisp target delete <id>

# 4. Generación de sondas NectarCanary
npx waisp canary generate https://mi-app.com

# 5. Abrir la Consola Web localmente con puerto personalizado
npx waisp studio --port 3722
```

---

## 💻 SDK Node.js / TypeScript (`terra-waisp`)

```typescript
import { Waisp } from 'terra-waisp';

const waisp = new Waisp({ githubToken: process.env.GITHUB_TOKEN });

// Auditar una aplicación
const result = await waisp.scan({
  target: 'https://mi-app.com',
  modules: ['recon', 'dast', 'api', 'runtime'],
  createIssues: true
});

console.log(`Puntuación Máxima CVSS: ${result.summary.cvssMax}`);
```

---

## 📜 Licencia MIT
Desarrollado bajo la filosofía **Terra • Seguridad Ofensiva a Coste $0**.
