/* 
    PACKAGE BUYER BACKEND AND CHAPA API PAYMENT INTEGRATION
    Required: Chapa secret key || GET THE KEY BY REGISTERING @ https://dashboard.chapa.co/register
*/

const mongoose = require("mongoose");
const express = require("express");
const { User } = require("./schema/user");

const app = express()

const axios = require("axios").default

require("dotenv").config()

const PORT = process.env.PORT || 4400

const CHAPA_URL = process.env.CHAPA_URL || "https://api.chapa.co/v1/transaction/initialize"
const CHAPA_AUTH = process.env.CHAPA_AUTH  || "CHASECK_TEST-Kj2iK6nWtlpa6yyV9Z2zS8u62Nw3Mx8o"

app.use(express.json());

// mongodb connection
const MONGO_URI = "mongodb+srv://bereketkassahun456_db_user:SD7UI4EDbahaJfHe@cluster0.hdyxpts.mongodb.net/package_buyer?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {})
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch((err) => console.error("MongoDB connection error:", err));

// req header with chapa secret key
const config = {
    headers: {
        Authorization: `Bearer ${CHAPA_AUTH}`
    }
}

// entry for the front end
app.get('/', (req, res) => {
    res.send('package buyer backend')
})

// initial payment endpoint
app.post("/api/pay", async (req, res) => {
         // chapa redirect you to this url when payment is successful
        const CALLBACK_URL = "https://package-buyer-backend.vercel.app/api/verify-payment/"
        const RETURN_URL = "https://package-buyer-backend.vercel.app/api/payment-success/"

        // a unique reference given to every transaction
        const TEXT_REF = "tx-myecommerce12345-" + Date.now()

        const amount = req.body?.amount;
        console.log("Amount:", req.body);
        // form data
        const data = {
            amount: amount, 
            currency: 'ETB',
            email: 'ato@ekele.com',
            first_name: 'Ato',
            last_name: 'Ekele',
            tx_ref: TEXT_REF,
            callback_url: CALLBACK_URL + TEXT_REF,
            return_url: RETURN_URL
        }

        // post request to chapa
        await axios.post(CHAPA_URL, data, config)
            .then((response) => {
                // res.redirect(response.data.data.checkout_url)
                console.log("Checkout url:", response.data.data.checkout_url)
                res.json({checkoutUrl: response.data.data.checkout_url, text_ref: TEXT_REF});
            })
            .catch((err) => console.log(err))
})

// verification endpoint
app.get("/api/verify-payment/:id", async (req, res) => {
    try {
        // verify the transaction
        const response = await axios.get("https://api.chapa.co/v1/transaction/verify/" + req.params.id, config);
        const body = response.data;
        // Expected response shape (example): { message, status: 'success', data: { email, amount, charge, status, ... } }
        if (!body) return res.status(500).json({ error: 'Empty response from Chapa' });

        // Check overall and payment status
        const ok = body.status === 'success' || (body.data && body.data.status === 'success');
        if (!ok) {
            console.log('Payment verification failed or returned non-success status', body);
            return res.status(400).json({ error: 'Payment not successful', verification: body });
        }

        const data = body.data || {};
        const email = data.email;
        const amount = Number(data.amount) || 0;
        const charge = Number(data.charge) || 0;
        const net = amount - charge;

        if (!email) {
            console.log('Verified payment missing email, cannot update wallet', data);
            return res.status(400).json({ error: 'Verified payment missing email' });
        }

        // Find user and update wallet
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found for email', email);
            return res.status(404).json({ error: 'User not found', email });
        }

        user.wallet = (user.wallet || 0) + net;
        await user.save();

        console.log(`Wallet updated for ${email}: +${net} (amount ${amount} - charge ${charge})`);
        return res.json({ message: 'Payment verified and wallet updated', email, amount, charge, net, user });

    } catch (err) {
        console.error('Payment verification error', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Payment verification error', details: err && err.message ? err.message : err });
    }
})

// Create user endpoint
app.post("/api/create-user", async (req, res) => {
    try {
        const { email, first_name, last_name, phone_number, wallet } = req.body;
        const user = new User({ email, first_name, last_name, phone_number, wallet });
        await user.save();
        res.status(201).json({ message: "User created successfully", user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Check if user exists endpoint
app.post("/api/check-user", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        const user = await User.findOne({ email });
        if (user) {
            res.json({ exists: true, user });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log("Server listening on port:", PORT))