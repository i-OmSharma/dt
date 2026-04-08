import amqp from 'amqplib';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
});

export const startSendConsumer = async()=> {
    try {
        const connection = await amqp.connect({
            protocol: 'amqp',
            hostname: process.env.RabbitMQ_HOSTNAME,
            port: 5672,
            username: process.env.RabbitMQ_USERNAME,
            password: process.env.RabbitMQ_PASSWORD,
            })
     
        const channel = await connection.createChannel();
        const queueName = "send-otp";
        await channel.assertQueue(queueName, {
            durable: true
        });

        console.log("Consumer mail service started, listening for OTP emails");


        channel.consume(queueName, async (message) => {
            if(message) {
                try {
                    const {to, subject, body} = JSON.parse(message.content.toString());

                    await transporter.sendMail({
                        from: `"secOTP" <${process.env.MAIL_USER}>`,
                        to,
                        subject,
                        text: body
                    })
                    
                    console.log(`OTP send to ${to}`);
                    channel.ack(message);
                } catch (error) {
                    console.log("Failed to send OTP", error);
                    channel.nack(message, false, false);
                }
            }
        })

    } catch (error) {
        console.log("Failed to start RabbitMQ consumer", error);
    }
}