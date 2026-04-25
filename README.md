# MenuFlow 🍽️✨

An AI-powered restaurant menu management system designed as a streamlined Micro-SaaS platform. MenuFlow helps restaurant owners easily manage, update, and optimize their digital menus with the power of artificial intelligence.

## 🚀 Overview

MenuFlow simplifies the process of creating and maintaining restaurant menus. By leveraging AI, it assists in generating appetizing descriptions and managing menu structures, while providing a fast, responsive user interface for seamless updates. 

This repository contains the Minimum Viable Product (MVP) build, focusing on a clean frontend integrated with a robust backend for real-time data syncing.

## 💻 Tech Stack

* **Frontend / UI:** [Lovable.dev](https://lovable.dev/) - For rapid, AI-assisted frontend development and clean component architecture.
* **Backend & Database:** [Supabase](https://supabase.com/) - Providing an open-source Firebase alternative for PostgreSQL database management, authentication, and instant API generation.

## ✨ Key Features

* **AI-Powered Menu Generation:** Automatically generate engaging dish descriptions and category layouts.
* **Real-time Updates:** Any changes to pricing or item availability are instantly synced via Supabase.
* **Intuitive Dashboard:** A user-friendly interface for restaurant managers to add, edit, or remove menu items on the fly.
* **Micro-SaaS Architecture:** Designed to be lightweight, scalable, and easy to deploy for multiple tenants.

## 🛠️ Getting Started

### Prerequisites

* Node.js (v18 or higher)
* npm or yarn
* A Supabase account and project setup

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yogesh-yogi-s/menuflowinair.git](https://github.com/yogesh-yogi-s/menuflowinair.git)
    cd menuflowinair
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    ```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yogesh-yogi-s/menuflowinair/issues).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ for the future of restaurant management.*
