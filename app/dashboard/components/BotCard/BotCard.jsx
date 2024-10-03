import { startBotProcess } from "@/app/actions/botAction";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const BotCard = () => {
    return (
        <Card
            className="sm:col-span-2" x-chunk="dashboard-05-chunk-0"
        >
            <CardHeader className="pb-3">
                <CardTitle>Bot Action</CardTitle>
            </CardHeader>
            <CardFooter>
                <form action={startBotProcess}>
                    <Button>Start Bot</Button>
                </form>
            </CardFooter>
        </Card>
    );
};

export default BotCard;