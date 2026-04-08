import amqp from "amqplib";

let channel: amqp.Channel;

export const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect({
            protocol: "amqp",
            hostname: process.env.RabbitMQ_HOSTNAME,
            port: 5672,
            username: process.env.RabbitMQ_USERNAME,
            password: process.env.RabbitMQ_PASSWORD,
        });

        connection.on("error", (err) => {
            console.error("RabbitMQ Connection Error:", err);
        });

        connection.on("close", () => {
            console.error("RabbitMQ Connection Closed");
        });

        channel = await connection.createChannel();

        console.log("RabbitMQ Connected");
    } catch (error) {
        console.error("Failed to connect to RabbitMQ", error);
    }
};

export const publishToQueue = async (
    queueName: string,
    message: any
): Promise<boolean> => {
    try {
        if (!channel) {
            console.error("RabbitMQ Channel is not defined");
            return false;
        }

        await channel.assertQueue(queueName, {
            durable: true,
        });

        return channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );
    } catch (error) {
        console.error("Error publishing to queue:", error);
        return false;
    }
};