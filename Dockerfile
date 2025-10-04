FROM python:bookworm

RUN apt update 
RUN apt upgrade

WORKDIR /app

COPY requirements.txt .
RUN pip3 install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python3", "./app.py"]
