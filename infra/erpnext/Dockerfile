FROM frappe/erpnext:v15.122.0@sha256:688083de94fa3af67b8fbc737a1f120d1a42bc491c01fc3700396d308f250866 AS upstream
FROM upstream
USER frappe
WORKDIR /home/frappe/frappe-bench
RUN bench get-app --branch v15.64.3 https://github.com/frappe/hrms \
    && cp -a sites/assets/. /home/frappe/frappe-bench/assets/
# bench get-app builds only HR assets; preserve the upstream Frappe/ERP manifests.
COPY --from=upstream --chown=frappe:root /home/frappe/frappe-bench/assets/assets.json /tmp/upstream-assets.json
COPY --from=upstream --chown=frappe:root /home/frappe/frappe-bench/assets/assets-rtl.json /tmp/upstream-assets-rtl.json
COPY --chown=frappe:root merge-assets.py /tmp/merge-assets.py
RUN python /tmp/merge-assets.py
