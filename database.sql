-- Создание базы данных
CREATE DATABASE IF NOT EXISTS angola_db;
USE angola_db;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица провинций Анголы
CREATE TABLE IF NOT EXISTS provinces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gdp_2017 DECIMAL(15,2),
    gdp_2018 DECIMAL(15,2),
    gdp_2019 DECIMAL(15,2),
    gdp_2020 DECIMAL(15,2),
    gdp_2021 DECIMAL(15,2),
    gdp_2022 DECIMAL(15,2),
    investment_tax DECIMAL(5,2),
    infrastructure_score DECIMAL(5,2),
    education_score DECIMAL(5,2),
    health_score DECIMAL(5,2),
    population INT,
    area DECIMAL(10,2)
);

-- Вставка данных о провинциях
INSERT INTO provinces (name, gdp_2017, gdp_2018, gdp_2019, gdp_2020, gdp_2021, gdp_2022, investment_tax, infrastructure_score, education_score, health_score, population, area) VALUES
('Луанда', 120.5, 125.3, 130.1, 115.4, 128.7, 135.2, 15.5, 9.2, 8.7, 9.0, 8345000, 2418),
('Уиже', 45.2, 47.1, 49.3, 44.5, 48.9, 52.1, 12.0, 6.5, 5.8, 6.2, 1450000, 58698),
('Малаиже', 38.7, 40.2, 42.0, 38.1, 41.5, 44.8, 11.5, 5.9, 5.4, 5.7, 986000, 97602),
('Бенгела', 55.6, 57.9, 60.4, 55.0, 59.8, 63.2, 13.0, 7.1, 6.8, 7.0, 2350000, 39827),
('Уамбо', 42.3, 44.0, 46.1, 41.8, 45.6, 48.9, 11.8, 6.2, 6.0, 6.3, 1890000, 35134),
('Бие', 40.1, 41.8, 43.5, 39.2, 42.8, 45.6, 11.2, 6.0, 5.7, 6.1, 1455000, 70314),
('Моксико', 35.4, 36.9, 38.2, 34.5, 37.8, 40.1, 10.8, 5.5, 5.2, 5.4, 758000, 223023),
('Квандо-Кубанго', 32.1, 33.5, 34.8, 31.2, 34.1, 36.5, 10.5, 5.3, 5.0, 5.2, 534000, 199049),
('Заире', 48.3, 50.1, 52.0, 47.5, 51.2, 54.8, 12.5, 6.8, 6.3, 6.7, 1095000, 40000),
('Кабинда', 62.4, 65.1, 67.8, 61.2, 66.5, 70.3, 14.0, 7.8, 7.2, 7.5, 716000, 7270);

-- Создание индексов для производительности
CREATE INDEX idx_province_name ON provinces(name);
CREATE INDEX idx_user_username ON users(username);