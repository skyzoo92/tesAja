import { proto } from '../../WAProto';

declare namespace riyoo {
    interface MediaUploadOptions {
        fileEncSha256?: Buffer;
        mediaType?: string;
        newsletter?: boolean;
    }

    type WAMediaUploadFunction = (
        stream: Buffer | NodeJS.ReadableStream, 
        options?: MediaUploadOptions
    ) => Promise<{ url: string; directPath: string }>;

    interface WAMessageContentGenerationOptions {
        upload?: WAMediaUploadFunction;
        mediaCache?: any;
        options?: any;
        logger?: any;
    }

    interface StickerMessage {
        url: string;
        fileSha256: Buffer | string;
        fileEncSha256: Buffer | string;
        mediaKey: Buffer | string;
        mimetype: string;
        directPath: string;
        fileLength: number | string;
        mediaKeyTimestamp: number | string;
        isAnimated?: boolean;
        stickerSentTs?: number | string;
        isAvatar?: boolean;
        isAiSticker?: boolean;
        isLottie?: boolean;
    }

    interface PaymentMessage {
        amount: number;
        currency?: string;
        from?: string;
        expiry?: number;
        sticker?: { stickerMessage: StickerMessage };
        note?: string;
        background?: {
            id?: string;
            fileLength?: string;
            width?: number;
            height?: number;
            mimetype?: string;
            placeholderArgb?: number;
            textArgb?: number;
            subtextArgb?: number;
        };
    }

    interface ProductMessage {
        title: string;
        description: string;
        thumbnail: string;
        productId: string;
        retailerId: string;
        url: string;
        body?: string;
        footer?: string;
        buttons?: proto.Message.InteractiveMessage.INativeFlowButton[];
    }

    interface InteractiveMessage {
        title: string;
        footer?: string;
        thumbnail?: string;
        buttons?: proto.Message.InteractiveMessage.INativeFlowButton[];
        nativeFlowMessage?: proto.Message.InteractiveMessage.INativeFlowMessage;
    }

    interface AlbumItem {
        image?: { url: string; caption?: string };
        video?: { url: string; caption?: string };
    }

    interface EventMessageLocation {
        degreesLatitude: number;
        degreesLongitude: number;
        name: string;
    }

    interface EventMessage {
        isCanceled?: boolean;
        name: string;
        description: string;
        location?: EventMessageLocation;
        joinLink?: string;
        startTime?: string | number;
        endTime?: string | number;
        extraGuestsAllowed?: boolean;
    }
    
    interface PollVote {
        optionName: string;
        optionVoteCount: string | number;
    }
    
    interface PollResultMessage {
        name: string;
        pollVotes: PollVote[];
    }
 
    interface MessageContent {
        requestPaymentMessage?: PaymentMessage;
        productMessage?: ProductMessage;
        interactiveMessage?: InteractiveMessage;
        albumMessage?: AlbumItem[];
        eventMessage?: EventMessage;
        pollResultMessage?: PollResultMessage;
    }

    interface MessageOptions {
        quoted?: proto.IWebMessageInfo;
        filter?: boolean;
    }
}

declare class riyoo {
    constructor(
        utils: {
            prepareWAMessageMedia: (media: any, options: riyoo.WAMessageContentGenerationOptions) => Promise<any>;
            generateWAMessageContent: (content: any, options: riyoo.WAMessageContentGenerationOptions) => Promise<any>;
            generateWAMessageFromContent: (jid: string, content: any, options?: any) => Promise<any>;
            generateMessageID: () => string;
        },
        waUploadToServer: riyoo.WAMediaUploadFunction,
        relayMessageFn?: (jid: string, content: any, options?: any) => Promise<any>
    );
    
    detectType(content: riyoo.MessageContent): 'PAYMENT' | 'PRODUCT' | 'INTERACTIVE' | 'ALBUM' | 'EVENT' | 'POLL_RESULT' | null;

    handlePayment(
        content: { requestPaymentMessage: riyoo.PaymentMessage },
        quoted?: proto.IWebMessageInfo
    ): Promise<{ requestPaymentMessage: proto.Message.RequestPaymentMessage }>;

    handleProduct(
        content: { productMessage: riyoo.ProductMessage },
        jid: string,
        quoted?: proto.IWebMessageInfo
    ): Promise<{ viewOnceMessage: proto.Message.ViewOnceMessage }>;

    handleInteractive(
        content: { interactiveMessage: riyoo.InteractiveMessage },
        jid: string,
        quoted?: proto.IWebMessageInfo
    ): Promise<{ viewOnceMessage: proto.Message.ViewOnceMessage }>;

    handleAlbum(
        content: { albumMessage: riyoo.AlbumItem[] },
        jid: string,
        quoted?: proto.IWebMessageInfo
    ): Promise<any>;

    handleEvent(
        content: { eventMessage: riyoo.EventMessage },
        jid: string,
        quoted?: proto.IWebMessageInfo
    ): Promise<any>;
    
    handlePollResult(
        content: { pollResultMessage: riyoo.PollResultMessage },
        jid: string,
        quoted?: proto.IWebMessageInfo
    ): Promise<any>;
}

export = riyoo;