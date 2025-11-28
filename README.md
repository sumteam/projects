# **sumtyme.ai, explained**

*A brief overview of the startup who created a new type of AI called causal intelligence.*

---

# **1. Why do we need a new form of AI?**

Although it feels like there are many different AI systems today - ChatGPT, Claude, Gemini, Grok - virtually all modern AI models are built on the same underlying blueprint: **the neural network**.

Neural networks are powerful, but they share a foundational limitation:

### **They are trained on past data, and once trained, they become fixed in place - even when the world continues to change.**

This fixedness becomes a serious problem in **complex systems**.

Complex systems - like financial markets, climate systems, supply chains, economies and ecosystems - do not behave like static functions. They are dynamic environments built from countless interacting components. 

Because these interactions compound and progress, these systems evolve in non-linear ways, moving into new states abruptly. 
They reorganise the very patterns that once governed them.

### **Emergent behaviour**

Emergent behaviour is when many small interactions compound into something qualitatively new - something that did not exist, and was not predictable, from the individual parts of a system.

Emergent behaviour is present in new state transitions such as:

* A pandemic
* A new climate regime
* A structural break in demand
* A previously unseen market regime

These are not “outliers.” They come from natural properties of complex systems.

### **The problem:**

Neural networks cannot adapt to emergent behaviour, because the new states they cause have no precedent in training data.
So when the environment enters a new state - COVID-19, a financial crash, or a climate anomaly - the model’s memory becomes obsolete, having internalised patterns that are no longer relevant.

**We're forever using yesterday's data to try to understand today's world, and precisely when we need intelligence the most, the model breaks.**

This is why we need a new form of AI: one that does not rely on the past, but instead one that uses the present to understand how the environment is evolving *right now*.

---

# **2. What is causal intelligence?**
Traditionally, we've looked at cause and effect in a simple way:

**Cause → Effect**

However, we've taken a slightly different view on cause and effect with our technology, where a cause alters the internal state of the environment and that leads to an observable effect.

**Cause → Change in Environment → Effect**

This is why we use the term causal intelligence.

**Causal intelligence** is a new type of artificial intelligence designed to understand **how an environment evolves over time**.

Instead of trying to predict the future based on history, causal intelligence focuses on ***how the present shapes the future.***

It does this by:

* Observing how the environment is changing *in the moment*
* Detecting the first internal shift that will later evolve into a visible effect
* Understanding how that initial change propagates
* Tracking those propagations from micro changes into macro outcomes

A traditional model asks:

> “Given the past, what is the next value?”

A causal intelligence asks:

> “Is the environment changing now? If so, how is that change evolving?”

This reframes forecasting from next step prediction to *real-time causal tracking*.

It is the only approach that can continously navigate systems with continuous reorganisation and emergent behaviour.

---

# **3. How we have built the first causal intelligence**

We built the world’s first causal intelligence by developing a set of mathematical learning algorithms that operate on the **most present 5000 data points** of a time series, at different frequencies.

Below is a simple explanation of the key steps in our process.

---

## **(a) Working on the most present data**

At every timescale (e.g. 1s, 5s, 1m), the machine takes the most recent **5000 data points** and analyses only the live structure of the environment.

No historical memory.
No training phase.
No learned parameters.

This ensures the system always stays aligned with the environment as it currently exists.

---

## **(b) Identifying relationships between data points using category theory**

Neural networks search for **patterns** within data points.
Patterns tell the machine *what things look like*.

Causal intelligence does something different:

### It identifies **relationships between data points**, not patterns within them.

This is done with a proprietary algorithm rooted in **category theory**, which is a branch of mathematics focused on relationships, mappings, and transformations.

Why relationships?

* Patterns describe what the structure of a data point is
* Relationships describe **how a time series changes over time**

We aren’t trying to teach the machine what the data is - only **how the time series is evolving**.

This relational structure becomes the foundation for detecting change.

---

## **(c) Constructing a state space embedding (extending Takens’ Theorem)**

Next, another algorithm creates a mathematical representation of the real-world environment that produced the data. This is known as a **state space embedding**.

State space embeddings are not new.
The most famous framework - **Takens’ Theorem** - shows how you can reconstruct an environment from time-series data.

Takens helps answer the question:

> “What does the environment look like?”

But Takens does not tell you:

* How the environment is changing
* Whether the structure is shifting
* How internal dynamics are evolving
* How the system is reorganising in real time

So we **extended Takens’ Theorem**, combining:

* Knowledge of the environment (from the embedding)
* Knowledge of how the environment evolves (from relational analysis in (a))

This produces a continuously updating representation of the environment *and how it changes over time*.

---

## **(d) Detecting when the environment has changed**

Once the environment is reconstructed, the machine analyses it to determine:

1. **Has the structure of the environment changed?**
2. **If so, what direction is the environment now evolving in?**
3. **How is the environment changing?**

This is the core of causal intelligence:
detecting the earliest internal shift that will later produce an observable effect.

---

## **(e) Tracking how a change evolves across frequencies (the raindrop analogy)**

All large effects begin with a **small change in the environment** at a specific instant.

This is why we start by processing **extremely high-frequency data** - to detect the earliest possible sign of a structural shift.

Think of a raindrop hitting a pond:

* At the instant of contact, **no ripples are visible**, but the amount of water in the pond has changed.
* The ripples - the visible effects - appear later.

Our process:

* High-frequency data detects the **initial change in the amount of water in the pond**
* Lower-frequency data tracks how that change **evolves into ripples**

This gives us a picture of how a causal chain look:

**Micro change → Evolution of change → Macro effect**

Not every initial change produces a major effect.
Some die quickly.
Some propagate slowly.
Some become large macro movements.

By comparing timescales, you can see:

* Whether the effect is growing
* Whether it is fading
* How sustained it is
* How close it is to completion

This is why users submit multiple timeframes to the CIL - to track the evolution of change from micro to macro.

---

## **(f) Continuous reconstruction (no memory)**

With every new data point:

* The moving window shifts
* The latest 5000 points are analyzed
* A new relational structure is built
* A new state space is constructed
* Evolution is re-evaluated

There is **no memory** in the system.

This is critical because:

### The environment itself is continuously evolving, so the intelligence must evolve with it.

The system never gets stuck in past behaviour.

---

# **4. Why causal intelligence is useful**

Causal intelligence is uniquely powerful because it directly addresses the **emergence problem**.

### **1. It detects environmental changes at the moment they occur**

This removes the blindness that traditional models have to shocks or sudden state transitions.

### **2. It allows you to understand effects before they become observable**

Because we detect the initial internal shift, not the visible outcome.

### **3. It requires no training**

No historical data.
No retraining cycles.
No model degradation.
Huge savings in time and cost.

### **4. It is parameter-free and fully deterministic**

There are no statistical assumptions or random components.
Every output is the result of deterministic mathematical structure.

This makes causal intelligence ideal for:

* Risk management
* Early warning systems
* Regime detection
* Operations forecasting
* Market intelligence
* Climate shifts
* Supply chain disruption monitoring
* Automated decision systems

---

# **5. How to use our causal intelligence (CIL Guide)**

The platform that you use to gain access to our technology is called the **Causal Intelligence Layer (CIL)**.

You submit your own time-series data at different frequencies.
We run the algorithms described above.
You receive an insight called **chain_detected**, which is either:

* **+1** → Upward causal chain
* **0** → No chain
* **-1** → Downward causal chain

### It is very important to understand:

**We do not do next-step prediction. We track non-linear behaviour of time series.**

A +1 on the 1-minute timescale does *not* mean price will rise in the next minute.

It means:

> **The time series is in a state that will move upward over time.**

The timescales allow you to track how that evolution spreads from micro → macro. A 1-minute timescale detects changes that are more micro, for example.

---

## **5.1 Timescale network**

As mentioned earlier, change forms at the highest frequency and evolves through lower frequencies.

So your timescale network determines:

* How early you detect change
* How far you track its evolution
* How precisely you understand its propagation

### Guidelines:

* Keep no more than a **5× gap** between timescales
  (e.g. 1m → 5m, or 2s → 10s)
* The more timescales you include, the more accurately you can track change
* Always start from highest frequency → lowest frequency

Tracking does **not** work the other way around.

---

## **5.2 Data Inputs & Preprocessing**

You must submit a **5001-point moving window**:

* **5000 live data points**
* **1 placeholder row** (all zeroes)

  * Timestamp = one interval after latest real timestamp

### Formats:

**OHLC:**
`datetime, open, high, low, close` → `ohlc_forecast()`

**Univariate:**
`datetime, value` → `univariate_forecast()`

### Alignment rules:

* Datetimes must align with the timeframe

  * 3m → HH:00, HH:03, HH:06…
  * 2s → HH:MM:00, HH:MM:02…
* Datetimes must be chronological
* Second-to-last row = most recent real data
* Last row = placeholder zero row

Once a new data point comes in, you need to shift the window one step so that you are constantly using the most recent 5000 data points to forecast. 

### For historical analysis

Use `rolling_forecast()` — no moving window needed.

---

## **5.3 Propagation Analysis**

A propagation occurs when a causal chain detected at one timescale later appears at the next lower frequency. The `chain_detected` values across the timescales align. 

Propagation tells you **how a change moves through timescales**. You can think of them as checkpoints that tell you when a change is evolving into a more sustained, macro-scale change.

Example:

* 1m = +1
* 2m (later) = +1 → **propagation**
* 3m (later) = +1 → **propagation**

### Why propagations matter:

* They show how a change is evolving
* They confirm the formation of a sustained directional move
* They reveal when a direction is fading or ending
* They can help you understand how large the directional change will be
* They allow you to build real-world decision systems

By taking time to understand these propagations, you can build algorithms that enable:

* Automatic risk management
* Early-warning systems
* Demand forecasting
* Algorithmic decision-making

These three components make up most of how to develop with sumtyme, laying the foundation for you to combine the CIL with other technologies. For example, you could use a neural network model with CIL outputs to determine the magnitude of a directional movement from the distance between a certain number of propagations.

More information on us is available at https://docs.sumtyme.ai or https://www.linkedin.com/company/sumtyme-ai.
