import { PartyCode } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    partyCode: PartyCode;
    partyName: string;
    partyId: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      partyCode: PartyCode;
      partyName: string;
      partyId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    partyCode: PartyCode;
    partyName: string;
    partyId: string;
  }
}
