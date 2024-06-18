#!/bin/sh
set -e
/usr/sbin/sshd
exec gunicorn -b 0.0.0.0:80 app:app