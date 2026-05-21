# Production Follow-up Management System (Production-FMS)

Welcome to the **Production-FMS** project! This system is designed to streamline and track the entire manufacturing process, from the moment an order is received to the final quality check and delivery.

## 🚀 How the System Works (Step-by-Step)

We have broken down the complex manufacturing process into simple, manageable steps. Here is how a product moves through our system:

### 1. Order Entry & Planning
Everything starts when a new order is received. The team enters the order details, including the customer name, product type, and quantity. We also set a **priority** and a **target delivery date** to make sure we stay on track.

### 2. Preparing Materials (Full Kitting)
Before we can start building, we need to make sure we have all the "ingredients." The **Full Kitting** stage involves gathering all the raw materials needed for the specific order. This ensures no production delays once we start.

### 3. Creating the Job Card
Think of a **Job Card** as a "Passport" for a product batch. It contains all the instructions for the factory floor, such as who is the supervisor, which machine to use, and exactly what needs to be made.

### 4. Physical Production
This is where the magic happens! The factory team follows the Job Card to manufacture the product. During this stage, we record:
*   Exactly how much raw material was used.
*   How many hours the machines were running.
*   Any notes from the supervisor.

### 5. Multi-Stage Quality Testing
We take quality seriously. The product goes through three major "checkpoints":
*   **Physical Test:** Checking how the material flows and how long it takes to set.
*   **Strength Test:** Testing how strong the product is at extremely high temperatures (up to 1100°C!).
*   **Chemical Test:** A scientific analysis to ensure the chemical balance (like Alumina and Iron levels) is perfect.

### 6. Final Tally & Completion
Once the product passes all tests, we do a final count (**Tally**) to make sure the quantity matches the order. Finally, we mark the order as **Done**, and it's ready for the customer!

---

## 📊 Workflow Diagram

The diagram below shows the visual flow of information and products through our system:

```mermaid
graph TD
    A[🛒 Order Received] --> B[📦 Full Kitting<br/>(Gather Materials)]
    B --> C[📝 Job Card Created]
    C --> D[🏭 Production Start]
    
    subgraph "Production Phase"
    D --> E[🏗️ Actual Production<br/>(Raw Materials & Machine Hours)]
    E --> F[🔨 Crushing / Processing]
    end
    
    F --> G{🔬 Quality Checks}
    
    subgraph "Quality Control (QC)"
    G --> H[⚖️ Composition QC]
    H --> I[🌡️ Lab Testing 1<br/>(Physical Properties)]
    I --> J[🔥 Lab Testing 2<br/>(Strength & Density)]
    J --> K[🧪 Chemical Test<br/>(Chemical Balance)]
    end
    
    K --> L[✅ Final Verification / Tally]
    L --> M[🏁 Mark as Done]
    M --> N[🚚 Ready for Delivery]
    
    style A fill:#e1f5fe,stroke:#01579b
    style N fill:#e8f5e9,stroke:#1b5e20
    style G fill:#fff3e0,stroke:#e65100
    style D fill:#f3e5f5,stroke:#4a148c
```

---

## 👥 Who Uses This System?
*   **Production Managers:** To oversee all orders and ensure everything is running on time.
*   **Factory Supervisors:** To create job cards and record daily production details.
*   **Lab Technicians:** To perform and record the results of quality tests.
*   **Management:** To view high-level summaries and financial reports.

---

## 🛠️ Technology Used
*   **Frontend:** Modern web interface built with React and Next.js.
*   **Database:** Powered by Supabase for real-time updates.
*   **Styling:** Clean and professional look using Tailwind CSS.
*   **Tracking:** Advanced logic to monitor "Planned vs. Actual" dates to identify delays.

---
*Created with ❤️ for the Production Management Team.*
