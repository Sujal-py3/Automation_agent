// src/WhatsApp/dto/whatsapp-message.dto.ts
export interface WhatsAppMessageDto {
    to: string;
    type: string;
    text?: {
      body: string;
    };
    interactive?: {
      type: string;
      body: {
        text: string;
      };
      action: {
        buttons: {
          type: string;
          reply: {
            id: string;
            title: string;
          };
        }[];
      };
    };
  }