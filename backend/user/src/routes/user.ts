import express from 'express'
import { 
        loginUser, 
        registerUser,
        myProfile, 
        getAllUsers, 
        getAUser, 
        updateName,
        getBalance
        } from '../controller/user.js';
import { verifyUser } from '../controller/verifyUser.js'
import { initiateTransaction, verifyTransactionOTP, getTransactionHistory } from '../controller/transaction.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';


const router = express.Router();

router.post("/login", loginUser)
router.post("/register", registerUser)
router.post("/verify", verifyUser)
router.get("/me", isAuth, myProfile)
router.get("/user/all", isAuth, isAdmin, getAllUsers)
router.get("/user/:id", isAuth, getAUser)
router.post("/update/user", isAuth, updateName)
router.get("/balance", isAuth, getBalance);
router.post("/transaction/initiate", isAuth, initiateTransaction);
router.post("/transaction/verify", isAuth, verifyTransactionOTP);
router.get("/transactions", isAuth, getTransactionHistory);

export default router;