FROM python:3.9-slim

WORKDIR /app
COPY clean_expired_data.py /app/
RUN pip install psycopg2-binary
RUN apt-get update && apt-get install -y cron

# 添加定時任務
RUN echo "* * * * * /usr/local/bin/python3 /app/clean_expired_data.py >> /var/log/cron.log 2>&1" > /etc/cron.d/clean_task \
    && chmod 0644 /etc/cron.d/clean_task \
    && crontab /etc/cron.d/clean_task

CMD ["cron", "-f"]
