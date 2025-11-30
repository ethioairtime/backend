/* 
    TELE CARD BUYER BACKEND AND CHAPA API PAYMENT INTEGRATION
    Required: Chapa secret key || GET THE KEY BY REGISTERING @ https://dashboard.chapa.co/register
*/

const mongoose = require("mongoose");
const express = require("express");
const { User } = require("./schema/user");
const { Order } = require("./schema/order");
const { CbeQueue } = require("./schema/cbe_queue");

const app = express()

const axios = require("axios").default

require("dotenv").config()

const PORT = process.env.PORT || 4400

const CHAPA_URL = process.env.CHAPA_URL || "https://api.chapa.co/v1/transaction/initialize"
const CHAPA_AUTH = process.env.CHAPA_AUTH  || "CHASECK_TEST-9LQQkOIge3B01HaSlVtdZrj5Vcg29272"

app.use(express.json());

// mongodb connection
const MONGO_URI = "mongodb+srv://airtime:vFz266J6aAWSrX8@cluster0.y5muu17.mongodb.net/airtime?appName=Cluster0";
// const MONGO_URI = "mongodb+srv://airtime:vFz266J6aAWSrX8@cluster0.hdyxpts.mongodb.net/airtime?retryWrites=true&w=majority";

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
    res.send('Ethio tele card backend')
})

// initial payment endpoint
app.post("/api/pay", async (req, res) => {
         // chapa redirect you to this url when payment is successful
        const CALLBACK_URL = "https://backend-blond-alpha-14.vercel.app/api/verify-payment/"
        const RETURN_URL = "https://backend-blond-alpha-14.vercel.app/api/payment-success/"

        // a unique reference given to every transaction
        const TEXT_REF = "tx-myecommerce12345-" + Date.now()

        const amount = req.body?.amount;
        
        const { email, first_name, last_name, phone_number, wallet } = req.body;
        // form data
        const data = {
            amount: amount, 
            currency: 'ETB',
            email: email,
            first_name: first_name,
            last_name: last_name,
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
        const { email, phone_number, wallet } = req.body;
        const user = new User({ email, phone_number, wallet });
        await user.save();
        res.status(201).json({ message: "User created successfully", user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Check if user exists endpoint
app.post("/api/check-user", async (req, res) => {
    try {
        const { email, phone_number } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        const user = await User.findOne({ email });
        if (user && user.phone_number === phone_number) {
            res.json({ exists: true, user });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// buy tele card endpoint
app.post('/api/buy-tele-card', async (req, res) => {
    try {
        const { email, amount, phone_number } = req.body;
        if (!email || typeof amount === 'undefined') {
            return res.status(400).json({ error: 'email and amount are required' });
        }

        const numericAmount = Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const wallet = Number(user.wallet || 0);
        if (wallet < numericAmount) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        // Deduct wallet and save
        user.wallet = wallet - numericAmount;
        await user.save();

        // Create order record
        const order = new Order({ email, amount: numericAmount, phone_number, status: 'paid' });
        await order.save();

        return res.status(200).json({ message: 'Tele card purchased', order, user });
    } catch (err) {
        console.error('Buy tele card error', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload SMS endpoint
app.post('/api/upload_sms', async (req, res) => {
    try {
        const { reference_number, amount } = req.body;
        
        if (!reference_number) {
            return res.status(400).json({ error: 'reference_number is required' });
        }
        
        if (typeof amount === 'undefined' || amount === null) {
            return res.status(400).json({ error: 'amount is required' });
        }

        const numericAmount = Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        // Create new SMS entry in cbe_queue
        const sms = new CbeQueue({
            reference_number,
            amount: numericAmount,
            phone_number: "0946722851",
            paid: false,
            verified: false,
        });
        
        await sms.save();

        return res.status(200).json({ 
            message: 'SMS registered successfully', 
            sms: {
                reference_number: sms.reference_number,
                amount: sms.amount,
                verified: sms.verified,
                created_at: sms.created_at
            }
        });
    } catch (err) {
        console.error('Upload SMS error', err && err.message ? err.message : err);
        if (err.code === 11000) {
            return res.status(400).json({ error: 'SMS with this reference_number already exists' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Check SMS endpoint
app.post('/api/check_sms', async (req, res) => {
    try {
        const { reference_number, phone_number } = req.body;
        
        if (!reference_number) {
            return res.status(400).json({ error: 'reference_number is required' });
        }

        if (!phone_number) {
            return res.status(400).json({ error: 'phone_number is required' });
        }

        // Find SMS in cbe_queue with the reference_number and verified: false
        const sms = await CbeQueue.findOne({ reference_number, verified: false });
        
        if (!sms) {
            return res.status(404).json({ error: 'SMS with the given reference_number not found or already verified' });
        }

        // Find user by phone number
        const user = await User.findOne({ phone_number });
        if (!user) {
            return res.status(404).json({ error: 'User not found with the given phone_number' });
        }

        // Mark the SMS as verified
        sms.verified = true;
        sms.phone_number = phone_number;
        await sms.save();

        // Update user wallet with SMS amount
        user.wallet = (user.wallet || 0) + sms.amount;
        await user.save();

        // Return the amount and updated wallet
        return res.status(200).json({ 
            message: `Reference Number verified successfully, ${sms.amount} was added to your wallet`, 
            amount: sms.amount,
            reference_number: sms.reference_number,
            verified: sms.verified,
            user: {
                email: user.email,
                phone_number: user.phone_number,
                wallet: user.wallet
            }
        });
    } catch (err) {
        console.error('Check SMS error', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Get unpaid queue endpoint
app.get('/api/unpaid_queue', async (req, res) => {
    try {
        // Find all SMS in cbe_queue with verified: false
        const unpaidSms = await CbeQueue.find({ paid: false, verified: true });
        
        return res.status(200).json({ 
            message: 'Unpaid queue retrieved successfully',
            count: unpaidSms.length,
            unpaid_queue: unpaidSms
        });
    } catch (err) {
        console.error('Get unpaid queue error', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify SMS endpoint
app.post('/api/mark_sms_paid', async (req, res) => {
    try {
        const { reference_number } = req.body;
        
        if (!reference_number) {
            return res.status(400).json({ error: 'reference_number is required' });
        }

        // Find SMS in cbe_queue with the reference_number
        const sms = await CbeQueue.findOne({ reference_number });
        
        if (!sms) {
            return res.status(404).json({ error: 'SMS with the given reference_number not found' });
        }

        // Update the SMS to verified: true
        sms.paid = true;
        await sms.save();

        return res.status(200).json({ 
            message: 'SMS marked paid successfully', 
            reference_number: sms.reference_number,
            amount: sms.amount,
            verified: sms.verified,
            paid: sms.paid,
        });
    } catch (err) {
        console.error('Verify SMS error', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => console.log("Server listening on port:", PORT))