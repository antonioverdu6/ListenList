# 🎶 ListenList

ListenList is a **music social network web app**, built with **Django (API backend)** and **React (frontend)**.  
Its goal is to let users **search music, rate and review** songs or albums using Spotify’s real-time catalog.

---

### 🎥 Demo del proyecto
[![Ver demo](https://img.youtube.com/vi/zpEnUtNpljM/0.jpg)](https://www.youtube.com/watch?v=zpEnUtNpljM)

---

## 🎧 How the app works

Instead of storing all artists, songs, and albums locally, the app uses the **Spotify Web API** to fetch the catalog in real time.  
This way, the database only stores the relevant information about the content that users interact with.

### 🔁 Basic user flow

1. **Music search**  
   The user types a term into the search bar (e.g., “Taylor Swift”).

2. **Request to Spotify API**  
   The backend uses [`spotipy`](https://spotipy.readthedocs.io/) to fetch real-time results (songs, albums, or artists).

3. **Content selection**  
   The user selects one result (e.g., the song *We Are Never Ever Getting Back Together*).

4. **Display and actions**  
   - The app shows details such as name, cover art, track list, links, and previews.  
   - The user can:
     - Rate with **1 to 5 stars** ⭐  
     - Write a **review or comment** 📝

5. **Database storage**  
   When the user interacts, only the minimum necessary data is stored:
   - Spotify ID  
   - Album/song name  
   - Relevant info to display it later  
   - Relation with the user + rating/comment  

---

## 📦 System benefits

- **Lightweight** → does not store Spotify’s entire catalog.  
- **Scalable** → the database grows only with user interactions.  
- **Up-to-date** → always shows the latest data from Spotify.  
- **Social** → focuses on user ratings and reviews.  

---

## ⚙️ Technical requirements

- **Backend**: Django + Django REST Framework  
- **Frontend**: React  
- **Spotify integration**:  
  - `spotipy` library  
  - Secure credentials: `client_id` and `client_secret`  
- **Main models**:  
  - `User`  
  - `Song`  
  - `Rating`  
  - `Comment`  
- **Extra logic**: avoid duplicates when storing content.  

---

## 🎨 Color palette

The design follows a modern, clean aesthetic inspired by Spotify:

- **Vibrant greens**: `#1db954`, `#17a74a`  
- **Dark backgrounds**: `#232526`, `#414345`  
- **Light text**: `#f5f6fa` (main), `#e0e0e0`, `#b2bec3` (secondary)  
- **Soft shadows**: translucent greens  

> Result: a modern, clean interface with good contrast and pleasant visuals.  

---

## 🚀 Installation & Usage

Follow these steps to run the project locally:

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ListenList.git
cd ListenList
```
---

### Set up the backend (Django)
```bash
python -m venv venv        # Create virtual environment (optional but recommended)
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows PowerShell

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Set up the frontend (React)
In another terminal, inside the frontend folder:
```bash
cd frontend
npm install
npm start
```
