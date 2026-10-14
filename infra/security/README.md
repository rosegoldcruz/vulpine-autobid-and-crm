# Host access hardening — 2026-10-14

SSH is restricted to root and the existing single entry in
`/root/.ssh/authorized_keys`. Password, keyboard-interactive, host-based, GSSAPI,
and certificate-authority authentication are disabled. No key was added or
replaced. The existing key matches recent successful SSH sessions. Tailscale
RunSSH is false. Install `00-vulpine-key-only.conf` under
`/etc/ssh/sshd_config.d/`, run `sshd -t`, then reload (not restart) ssh.
Keep the established key and a Hetzner recovery console available.

Host firewall source remains `/usr/local/sbin/vulpine-host-ingress`, enabled by
`vulpine-host-ingress.service`. IPv4 and IPv6 public INPUT permits established
traffic, SSH 22, HTTP 80, HTTPS 443, Tailscale UDP 41641, ICMP, and necessary IPv4
DHCP; other traffic is dropped. UFW is inactive because custom iptables rules
are in use. Do not enable a competing firewall manager over those rules.

`vulpine-private-ports-firewall` extends the existing private-port policy to
block NEW/INVALID connections arriving on eth0 through Docker's DOCKER-USER
chain, for IPv4 and IPv6. Nginx uses localhost upstreams. Container egress and
return traffic are preserved. Install this script in `/usr/local/sbin` and
`docker-firewall.conf` as `/etc/systemd/system/docker.service.d/vulpine-firewall.conf`.
The existing boot service applies the policy; Docker ExecStartPost reapplies it
after daemon starts. No Docker restart is required to apply it now.

The user is configuring a separate Hetzner Cloud Firewall. Suggested inbound:
TCP 22/80/443, UDP 41641, ICMP. Keep outbound allowed. Do not expose MariaDB,
PostgreSQL, Redis, n8n, application backends, or ERPNext's loopback 8090 port.
Public SSH requires the installed key; IP allowlisting should only be added
when a stable source or tested VPN recovery path is established.

Verification: sshd syntax/effective configuration, rejection of authentication
without a key, both active firewall chains, Docker restart persistence, and
existing HTTP health checks. A fresh successful login using the owner's private
key cannot be performed by the agent. Existing sessions were retained.

Known pre-existing monitor warning: Bids Tracker's PM2 working directory differs
from `/etc/vulpine-apps`'s recorded release path. Its HTTP health check passes;
this coincides with the pre-existing uncommitted tracker migration. Do not revert
or redeploy that work merely to silence the monitor. All other monitor checks
passed during this task. An external port scan and the Hetzner policy remain
separate verification steps; no claim of complete compromise assessment is made.
