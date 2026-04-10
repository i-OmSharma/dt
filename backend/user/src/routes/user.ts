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
import { verifyUser } from '../services/verifyUser.js'
import { initiateTransaction, verifyTransactionOTP, getTransactionHistory } from '../controller/transaction.js';
import { initiateRegistration, verifyRegistration } from '../controller/registration.js';
import { initiateContactVerification, confirmContactVerification } from '../controller/contactVerification.js';
import { initiateChangePassword, verifyChangePassword } from '../controller/changePassword.js';
import {
  initiateEmailChange,
  verifyEmailChange,
  initiatePhoneChange,
  verifyPhoneChange,
  initiatePasswordChangeSetting,
  verifyPasswordChangeSetting,
} from '../controller/accountSettings.js';
import { isAuth, isAdmin } from '../middleware/isAuth.js';


const router = express.Router();

router.post("/login", loginUser)
router.post("/register", registerUser)
router.post("/register/initiate", initiateRegistration)
router.post("/register/verify", verifyRegistration)
router.post("/verify", verifyUser)
router.get("/me", isAuth, myProfile)
router.get("/user/all", isAuth, isAdmin, getAllUsers)
router.get("/user/:id", isAuth, getAUser)
router.post("/update/user", isAuth, updateName)
router.get("/balance", isAuth, getBalance);
router.post("/verify-contact/initiate", isAuth, initiateContactVerification);
router.post("/verify-contact/confirm",  isAuth, confirmContactVerification);
router.post("/transaction/initiate", isAuth, initiateTransaction);
router.post("/transaction/verify", isAuth, verifyTransactionOTP);
router.get("/transactions", isAuth, getTransactionHistory);
router.post("/change-password/initiate", initiateChangePassword);
router.post("/change-password/verify", verifyChangePassword);
router.post("/settings/email/initiate",    isAuth, initiateEmailChange);
router.post("/settings/email/verify",      isAuth, verifyEmailChange);
router.post("/settings/phone/initiate",    isAuth, initiatePhoneChange);
router.post("/settings/phone/verify",      isAuth, verifyPhoneChange);
router.post("/settings/password/initiate", isAuth, initiatePasswordChangeSetting);
router.post("/settings/password/verify",   isAuth, verifyPasswordChangeSetting);

export default router;