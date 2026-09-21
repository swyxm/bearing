# <img src="public/bearing.png" width="40" align="top" style="margin-right: 8px;" /> Bearing

Welcome to **Bearing**! This tool is designed to help executives, strategists, and non-technical stakeholders quickly find their client's bearings. While this specific deployment is tailored for Shop-EY—assessing global e-commerce markets to determine where additional investment will drive the greatest business value, Bearing's underlying architecture is designed to be universally effective for navigating complex strategic decisions pertaining to global markets across any industry.

## What does this dashboard do?
The dashboard continuously tracks 13 global markets (such as the US, India, China, Canada, and Germany) by analyzing a mix of macroeconomic data and real-time financial performance of established retail and marketplace companies in those regions. 

It synthesizes thousands of data points into a single, easy-to-read **Decision Indicator Score** (0-100) and automatically categorizes each country into one of four recommended actions:
1. **Consider further investment** (Strongest candidates for growth and stability)
2. **Maintain and assess** (Solid markets to hold current positions in)
3. **Review incremental exposure** (Markets showing financial stress or operational weakness)
4. **Market watch** (Markets with insufficient peer data to make a confident move)

## How does it make these decisions?
The dashboard evaluates each market across four key pillars:

* **Market Opportunity:** How digitally ready is the country? We look at internet penetration, financial account ownership, GDP per capita, and population size.
* **Peer Operating Health:** How profitable are the existing companies there? We analyze the revenue growth and operating margins of local competitors.
* **Peer Price Momentum:** How is the stock market treating them? We track the recent 63-day stock price returns of local retail companies.
* **Stress Resilience:** How risky is it? We use a predictive Machine Learning model (Projected Peer Group Risk) to forecast the probability of high financial volatility over the next few months.

## How to use the Dashboard

### 1. The Overview Page
When you open the dashboard, you will see a global leaderboard. Markets are ranked from top to bottom based on their current score. 
* **Recommendation Cards:** Read the short, qualitative memos for each country to get immediate strategic context (e.g., "The US is the most established case," or "India offers strong momentum").
* **Click to Dive Deeper:** Click on any country row to open a detailed breakdown of exactly *why* it received its score.

### 2. The Interactive AI Assistant (Northstar)
See the floating **Northstar** button? <img src="public/northstar_white.png" width="32" style="vertical-align: middle;" /> That is your AI-powered strategic assistant.
* You can ask it plain-English questions like *"Which market has the highest peer stress?"* or *"Why is India a good growth bet?"* 
* Northstar can actually read the underlying datasets, financial models, and macroeconomic reports to give you a cited, factual answer.

### 3. Scenario Planning (The Toggles)
You'll see a slider icon on the left sidebar, the "Scenarios" tab. Because different executives have different priorities, Bearing's dashboard allows you to change the **weighting** of the four pillars:
* **Balanced Allocation:** Equal focus across all metrics.
* **Structural Capacity:** Heavily prioritizes macro Market Opportunity (great for finding safe, established markets like the US).
* **Growth Momentum:** Heavily prioritizes Price Momentum and Operations (great for finding high-upside bets like India).
* **Margin & Resilience:** Heavily prioritizes Profitability and low Stress Risk (great for defensive investments).

*Fun fact: You can even ask Northstar to change scenarios and update weights in realtime to compare different scenarios that reflect current business needs! Try it out w/ natural language!"*

---

## Repository Structure

If you're jumping into the codebase, here's how the repository is organized:

* **`app/`**: The Next.js (React) frontend. This contains all the UI components, pages, routing, and styling (like `Northstar.tsx` and the main dashboard views).
* **`api/`**: The Python backend. This runs as Vercel Serverless Functions and handles the real-time Machine Learning model predictions and the Northstar AI responses (`index.py`).
* **`lib/`**: Shared TypeScript utilities, algorithms (like the decision scoring logic), and the text for the strategy memos (`memos.ts`).
* **`models/`**: The pre-trained scikit-learn machine learning models (e.g., `stress.joblib`) used by the backend.
* **`generated/`**: Pre-calculated snapshots of the peer data and embeddings (e.g., `snapshot.json`) to keep the live app fast.
* **`Ecommerce_dataset/`**: *Offline only.* Raw source data and PDFs used by the data science team to originally train the ML models. It is not shipped to the live web app.

---

## Local Development if interested

Bearing is built with Next.js (React) for the frontend and uses Vercel Serverless Functions (Python) for the backend AI and ML APIs.

To run the dashboard locally:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   Because the backend uses Python serverless functions, it is highly recommended to use the Vercel CLI to spin up the local environment.
   ```bash
   npm i -g vercel
   vercel dev
   ```
   *(Alternatively, if you only need the frontend, you can run `npm run dev`.)*

3. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.
