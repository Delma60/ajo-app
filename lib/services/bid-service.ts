import { CircleService } from "@/lib/services/circle-service";
import type { Bid } from "@/lib/types/bid";

export class BidService {
  private service = new CircleService();

  async submitBid(circleId: string, userId: string, amountKobo: number): Promise<Bid> {
    return this.service.submitBid(circleId, userId, amountKobo);
  }
}
