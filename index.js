/* 
    CHAPA API PAYMENT INTEGRATION
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
// Provide MONGO_URI via environment variable for security.
// Example format (SRV): mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
const MONGO_URI = process.env.MONGO_URI;

function maskMongoUri(uri) {
    if (!uri) return uri;
    try {
        // mask password between : and @
        return uri.replace(/:(.*)@/, ':*****@');
    } catch (e) {
        return uri;
    }
}

async function connectWithRetry(maxRetries = 5, delayMs = 3000) {
    if (!MONGO_URI) {
        console.error('MONGO_URI is not set. Please set it in your .env or environment variables.');
        return;
    }

    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            attempt++;
            console.log(`Attempting MongoDB connection (attempt ${attempt}/${maxRetries}) to ${maskMongoUri(MONGO_URI)}`);
            await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
            console.log('Connected to MongoDB Atlas');
            return;
        } catch (err) {
            console.error(`MongoDB connection attempt ${attempt} failed:`);
            // Log a compact error message helpful for diagnosis
            console.error(err && err.message ? err.message : err);
            if (attempt < maxRetries) {
                console.log(`Retrying in ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
            } else {
                console.error('All MongoDB connection attempts failed. Check your MONGO_URI, network access (IP whitelist), and Atlas cluster status.');
            }
        }
    }
}

connectWithRetry();


// req header with chapa secret key
const config = {
    headers: {
        Authorization: `Bearer ${CHAPA_AUTH}`
    }
}

// entry for the front end
app.get('/', (req, res) => {
    res.render("index")
})

// initial payment endpoint
app.post("/api/pay", async (req, res) => {

         // chapa redirect you to this url when payment is successful
        const CALLBACK_URL = "http://localhost:4400/api/verify-payment/"
        const RETURN_URL = "http://localhost:4400/api/payment-success/"

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
                res.json({checkoutUrl: response.data.data.checkout_url});
            })
            .catch((err) => console.log(err))
})

// verification endpoint
app.get("/api/verify-payment/:id", async (req, res) => {
    
        //verify the transaction 
        await axios.get("https://api.chapa.co/v1/transaction/verify/" + req.params.id, config)
            .then((response) => {
                console.log("Payment was successfully verified")
            }) 
            .catch((err) => console.log("Payment can't be verfied", err))
})

// Create user endpoint

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