# Incident 2026-09-react2shell

Production host `i-0b7f49ca3e9852d4b` was compromised through the Next.js 15.1.6 React2Shell
RCE (CVE-2025-55182), exploited from **2026-08-13** and running a crypto-miner and the "tiktouk"
botnet by 2026-09-14. All secrets on the shared host are considered exposed. The fix is a full
rebuild onto an isolated-per-app host, not a clean-up of the old one.

## Read in this order

| Doc | What it is |
|---|---|
| `01-investigation-report.md` | What happened, with evidence. |
| `02-credential-inventory.md` | Every secret, whether exposed, and where to rotate it. `SECRET → exposed? → evidence → action`. |
| `03-containment-plan.md` | The destructive/isolating steps, each with impact — **needs approval**. |
| `04-secret-architecture.md` | The new per-app isolation design and how it is validated. |
| `05-recovery-runbook.md` | Phase-by-phase path from compromised host to clean production. |
| `IOCs.md` | Indicators of compromise and a sweep script for any other host. |

The implementation lives in `deploy/v2/` (this repo). The app upgrades are on branch
`incident/react2shell-recovery` here and in `Metnmat_Dashboard` and `METNMAT-chatbot`.

## Status (2026-09-16)

Done: evidence preserved (snapshot `snap-0d28d630743a401d3`, forensic bucket); both apps upgraded
past the vulnerable versions and validated (website Next 15.5.25, CMS Next 16.3.5 + Payload 3.89.0,
both React 19.2.8; Command Center Next 16.3.5); the new isolated deploy layer written; a quarantine
security group (`sg-0890559606eea14f8`) pre-created.

Waiting on the owner: approval to execute containment (`03`), the third-party credential
rotations only a human with console access can do (`02` Phase 2), and the Cloudflare DNS cutover.

Not done without approval: nothing on the live instance has been stopped, killed, deleted or
reconfigured. All investigation was read-only.
