## 1. Технологический стек
- **Фронтенд (Frontend)**: Electron (Node.js) для оболочки рабочего стола, HTML/CSS/JS для пользовательского интерфейса.
- **Бэкенд (Backend)**: Python (FastAPI), работающий как локальный сервер для обработки логики, данных и взаимодействия с базой данных.
- **База данных**: SQLite для легковесного локального хранения данных.
- **Формат данных**: JSON для взаимодействия через API.

---

## 2. Архитектура системы

Приложение следует клиент-серверной архитектуре, где "сервер" работает локально на машине пользователя и управляется "клиентом" Electron.

```mermaid
graph TD
    subgraph "Рабочая среда (Desktop)"
        E["Приложение Electron (Фронтенд)"]
        P["Бэкенд Python (FastAPI)"]
        DB[(База данных SQLite)]
    end

    E -- "Запускает процесс" --> P
    E -- "HTTP запросы (REST API)" --> P
    P -- "Чтение/Запись" --> DB
    P -- "Ответы JSON" --> E
    
    subgraph "Внешняя среда/Симуляция"
        S[Симулятор Глюкозы] -- "Поток данных" --> P
    end
```

### Поток взаимодействия
1. **Запуск**: При запуске приложения Electron (`main.js`), оно создает процесс Python как дочерний процесс.
2. **Рукопожатие**: Фронтенд ожидает сигнала готовности от бэкенда (через stdout "Uvicorn running").
3. **Взаимодействие**: Пользовательский интерфейс выполняет асинхронные запросы `fetch` к `http://127.0.0.1:8000`.
4. **Завершение работы**: Закрытие окна Electron убивает процесс Python для освобождения ресурсов.

---

## 3. Описание модулей

### Модули Бэкенда (Python)
Расположены в `backend/app/`:
- **`main.py`**: Точка входа. Настраивает API и подключает роутеры.
- **`models.py`**: Модели, определяющие структуры данных (например, `Patient`, `UserToken`).
- **`routers/`**:
    - **`auth.py`**: Обрабатывает вход пользователя и генерацию JWT токенов.
    - **`patients.py`**: Основная логика для списка, поиска и управления записями пациентов.
    - **`recommendations.py`**: Логика для анализа данных пациентов и генерации текстовых рекомендаций.
- **`analysis_utils.py`**: Вспомогательные функции для статистического анализа данных глюкозы.

### Компоненты Фронтенда (Electron/Web)
Расположены в `frontend/`:
- **`main.js`**: "Главный процесс" Electron. Обрабатывает создание окон, нативные меню и управление процессом бэкенда.
- **`html/`**:
    - `auth_page.html`: Экран авторизации.
    - `dashboard_page.html`: Основной интерфейс приложения.
- **`js/`**:
    - `dash_board.js`: отрисовка графиков (Chart.js) и проверка токенов.
- **`assets/`**: Иконки и стили.

---

## 4. Логика и Поток Данных

Следующая блок-схема иллюстрирует типичную сессию пользователя от входа в систему до анализа данных.

```mermaid
flowchart LR
    Start([Запуск приложения]) --> Auth{"Авторизован?"}
    Auth -- Нет --> Login[Экран входа]
    Login -- "Учетные данные" --> API_Auth[POST /token]
    API_Auth -- "Успех + Токен" --> Dashboard[Панель управления]
    Auth -- Да --> Dashboard

    subgraph "Действия на панели"
        Dashboard --> GetPatients[Загрузка списка пациентов]
        GetPatients --> Select[Выбор пациента]
        Select --> Data[Просмотр графиков и статистики]
        Select --> Recs[Получение рекомендаций]
    end

    subgraph "Фон"
        Sim[Симулятор] -- "Новые данные глюкозы" --> DB[(База данных)]
        DB --> Data
    end
```

---

## 5. API и База Данных

Ключевые запросы включают:

- **Auth**: `POST /token` - Проверяет учетные данные и возвращает токен доступа.
- **Patients**:
  - `GET /patients/` - Получить всех пациентов (поддерживает фильтрацию).
  - `GET /patients/{id}` - Получить детальную информацию о конкретном пациенте.
- **Recommendations**: `POST /recommendations/analyze` - Анализировать предоставленные метрики.

#### Детали схемы базы данных

Приложение использует SQLite со следующей реляционной структурой. Ключевые поля данных (имена, контактная информация, клинические записи) шифруются при хранении.

```mermaid
erDiagram
    DOCTORS ||--o{ PATIENTS : "управляет (manages)"
    PATIENTS ||--o{ MEDICAL_RECORDS : "имеет (has)"
    PATIENTS ||--o{ TIMESERIES_DATA : "логирует (logs)"
    PATIENTS ||--|| PATIENTS_PARAMETERS : "имеет (has)"
    PATIENTS ||--|| SIMULATOR_SCENARIOS : "имеет (has)"

    DOCTORS {
        int id PK
        string username
        string hashed_password
        string full_name
        string specialization
    }

    PATIENTS {
        int id PK
        int doctor_id FK
        string encrypted_full_name "AES Encrypted"
        string encrypted_contact_info "AES Encrypted"
        date date_of_birth
    }

    MEDICAL_RECORDS {
        int id PK
        int patient_id FK
        timestamp record_date
        string encrypted_record_data "AES Encrypted"
    }

    TIMESERIES_DATA {
        int id PK
        int patient_id FK
        timestamp timestamp
        string record_type "glucose, carbs, insulin"
        float value
        string encrypted_details 
    }

    PATIENTS_PARAMETERS {
        int id PK
        int patient_id FK
        string encrypted_parameters "JSON + AES"
    }

    SIMULATOR_SCENARIOS {
        int id PK
        int patient_id FK
        string encrypted_scenario "JSON + AES"
    }
```

#### Описание таблиц

1.  **`doctors`**: Хранит авторизованный медицинский персонал.
    *   `username`: Уникальный идентификатор для входа.
    *   `hashed_password`: Хэш пароля (Bcrypt).
    *   `is_active`: Механизм мягкого удаления.

2.  **`patients`**: Основные записи пациентов.
    *   **Шифрование**: `encrypted_full_name` и `encrypted_contact_info` обеспечивают безопасность персональных данных.
    *   `doctor_id`: Связывает пациента с его лечащим врачом.

3.  **`timeseries_data`**: Хранилище высокочастотных данных.
    *   Используется для хранения показаний глюкозы, болюсов инсулина и приема углеводов.
    *   `record_type`: Различает 'glucose' (глюкоза), 'insulin_bolus' (инсулин), 'carbs' (углеводы).
    *   `value`: Числовое значение показания/дозы.

4.  **`patients_parameters` & `simulator_scenarios`**:
    *   Хранят конфигурацию для симулятора.
    *   Данные хранятся как зашифрованные JSON-объекты, чтобы обеспечить гибкость изменения параметров без миграции схемы.

#### Заполнение данными (`seed_database.py`)
Система включает скрипт для заполнения базы данных тестовыми и демонстрационными данными:
*   Генерирует 5 синтетических пациентов используя `faker`.
*   Симулирует 30 дней непрерывного мониторинга глюкозы (CGM) (примерно 288 точек в день).
*   Симулирует реалистичные сценарии:
    *   **Прием пищи**: 3 раза в день (8:00, 13:00, 19:00) со случайным количеством углеводов.
    *   **Инсулин**: Расчетные дозы болюса на основе потребления углеводов.
    *   **Флуктуации**: Периодический случайный шум для имитации физиологической изменчивости.

---

## 6. Взаимодействие файлов и Поток Данных

Этот раздел детализирует, как различные модули кода взаимодействуют для выполнения запросов пользователя, от интерфейса до базы данных.

#### Зависимости модулей
Следующая диаграмма отображает отношения импорта и поток управления между ключевыми файлами.

```mermaid
classDiagram
    note "Стрелки указывают на Зависимость / Импорт"
    
    class ElectronMain["frontend/main.js"] {
        +createWindow()
        +spawn(python)
    }
    class FrontendUI["frontend/js/dashboard_page.js"] {
        +fetch(/api/patients)
        +renderChart()
    }
    class BackendMain["backend/app/main.py"] {
        +FastAPI()
        +include_router()
    }
    class PatientRouter["backend/app/routers/patients.py"] {
        +get_my_patients()
        +get_patient_glucose_data()
    }
    class Models["backend/app/models.py"] {
        +PatientDisplay
        +TimeSeriesDataPoint
    }
    class Database["medical_app.db"] {
        <<Файл SQLite>>
    }

    ElectronMain ..> BackendMain : Запускает процесс
    FrontendUI ..> BackendMain : HTTP запросы
    BackendMain --> PatientRouter : Подключает Router
    PatientRouter --> Models : Использует Схемы
    PatientRouter --> Database : SQL запросы
```

#### Детальная последовательность данных: Получение данных глюкозы
Отслеживание потока данных, когда пользователь выбирает пациента и просматривает график глюкозы.

```mermaid
sequenceDiagram
    participant UI as Dashboard (dashboard_page.js)
    participant API as FastAPI (main.py)
    participant Router as Patient Router (patients.py)
    participant DB as SQLite (medical_app.db)

    UI->>API: GET /api/patients/{id}/glucose_data
    API->>Router: Передача в get_patient_glucose_data()
    
    Router->>DB: SELECT id FROM patients...
    DB-->>Router: Пациент существует (ID)

    Router->>DB: SELECT * FROM timeseries_data...
    note right of DB: Фильтр по record_type='glucose'<br/>и диапазону дат
    DB-->>Router: Возврат строк [(timestamp, value)...]

    Router-->>API: Возврат JSON {labels: [...], data: [...]}
    API-->>UI: HTTP 200 OK (JSON)
    
    UI->>UI: Обновление экземпляра Chart.js
```

---

## 7. Обзор Интерфейса

### Аутентификация
Экран авторизации.
![Экран входа](images/Авторизация.png)

### Список пациентов 
Список пациентов и поиск среди них по ФИО и дате рождения.
- **Списки пациентов**:
  ![Список пациентов 1](images/Список_1.png)
  ![Список пациентов 2](images/Список_2.png)
  ![Список пациентов 3](images/Список_3.png)

### Реализация поведения панели
Панель можно свернуть и развернуть.
![Главная панель](images/Панель_1.png)
![Вторичная панель](images/Панель_2.png)

### Карточка пациента и общий вид приложения.
![Детальное окно 1](images/Окно_1.png)
![Детальное окно 2](images/Окно_2.png)
![Карточка пациента](images/Карточка_1.png)

### Аналитика и визуализация
Реализация графиков за определенный промежуток времени и просмотр точек на графике (уровень глюкозы в крови, введенный инсулин и поступление углеводов)
![График 1](images/График_1.png)
![График 2](images/График_2.png)
![График 3](images/График_3.png)
![График 4](images/График_4.png)
![График 5](images/График_5.png)

### Медицинские рекомендации
Реализация анализа рекомендаций.
![Рекомендации](images/Рекомендации.png)

### Режим симуляции
На данный момент реализовано получение данных для симуляции каждого конкретного пациента.
![Главная симулятора](images/Симулятор_1.png)
![Настройки симулятора](images/Симулятор_2.png)
