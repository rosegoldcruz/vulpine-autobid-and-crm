FROM frappe/erpnext:v15.122.0@sha256:688083de94fa3af67b8fbc737a1f120d1a42bc491c01fc3700396d308f250866
USER frappe
WORKDIR /home/frappe/frappe-bench
RUN bench get-app --branch v15.64.3 https://github.com/frappe/hrms \
    && cp -a sites/assets/. /home/frappe/frappe-bench/assets/
