# Privacy — Protecting Personal Information

**Chapter 7 — AI Safety and Privacy**

## 1. What does this folder do?

The `privacy/` folder contains code that helps protect personal information before it is shared with an AI model.

Employee feedback might contain information such as:

- Email addresses
- Phone numbers
- Names or other identifying details

We don't always need this information for AI analysis.

Our current implementation focuses on detecting and hiding common email addresses and UK mobile phone numbers.

This process is called **redaction**.

## 2. Why do we need it?

Imagine an employee submits this feedback:

"Contact john@example.com about the problems with management."

We want Gemini to understand the complaint, but it doesn't need the employee's email address.

We can replace the email address with a placeholder:

"Contact [EMAIL] about the problems with management."

This preserves the meaning of the feedback while reducing the amount of personal information shared.

## 3. How does it work?

```text
Original employee feedback
        ↓
redactPersonalData()
        ↓
Find email addresses
and UK mobile numbers
        ↓
Replace them with placeholders
        ↓
Redacted feedback
        ↓
Ready for further processing
```

**Important:** Redaction must be called explicitly. Having this helper in our