const WAProto = require('../../WAProto').proto;
const crypto = require('crypto');

class hydra {
    constructor(utils, waUploadToServer, relayMessageFn) {
        this.utils = utils;
        this.relayMessage = relayMessageFn
        this.waUploadToServer = waUploadToServer;
    }

    detectType(content) {
        if (content.requestPaymentMessage) return 'PAYMENT';
        if (content.productMessage) return 'PRODUCT';
        if (content.interactiveMessage) return 'INTERACTIVE';
        if (content.albumMessage) return 'ALBUM';
        if (content.eventMessage) return 'EVENT';
        if (content.pollResultMessage) return 'POLL_RESULT';
        if (content.carouselMessage || content.carousel) return 'CAROUSEL'; 
        return null;
}
    
    async handleCarousel(content, jid, quoted) {
    // 🔥 Support carouselMessage (native) & carousel (wrapper)
    const root = content.carouselMessage || content.carousel || {};
    const { caption = "", footer = "", cards = [] } = root;

    const carouselCards = await Promise.all(
        cards.map(async (card) => {
            if (card.productTitle) {
                // Mode Product
                return {
                    header: WAProto.Message.InteractiveMessage.Header.create({
                        title: card.headerTitle || "",
                        subtitle: card.headerSubtitle || "",
                        productMessage: {
                            product: {
                                productImage: (
                                    await this.utils.prepareWAMessageMedia(
                                        { image: { url: card.imageUrl } },
                                        { upload: this.waUploadToServer }
                                    )
                                ).imageMessage,
                                productId: card.productId || "123456",
                                title: card.productTitle,
                                description: card.productDescription || "",
                                currencyCode: card.currencyCode || "IDR",
                                priceAmount1000: card.priceAmount1000 || "100000",
                                retailerId: card.retailerId || "Retailer",
                                url: card.url || "",
                                productImageCount: 1
                            },
                            businessOwnerJid: card.businessOwnerJid || "0@s.whatsapp.net"
                        },
                        hasMediaAttachment: false
                    }),
                    body: WAProto.Message.InteractiveMessage.Body.create({
                        text: card.bodyText || ""
                    }),
                    footer: WAProto.Message.InteractiveMessage.Footer.create({
                        text: card.footerText || ""
                    }),
                    nativeFlowMessage: WAProto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: (card.buttons || []).map((btn) => ({
                            name: btn.name,
                            buttonParamsJson: JSON.stringify(btn.params || {})
                        }))
                    })
                };
            } else {
                // Mode Image biasa
                return {
                    header: WAProto.Message.InteractiveMessage.Header.create({
                        title: card.headerTitle || "",
                        subtitle: card.headerSubtitle || "",
                        hasMediaAttachment: !!card.imageUrl,
                        ...(card.imageUrl
                            ? await this.utils.prepareWAMessageMedia(
                                  { image: { url: card.imageUrl } },
                                  { upload: this.waUploadToServer }
                              )
                            : {}
                        )
                    }),
                    body: WAProto.Message.InteractiveMessage.Body.create({
                        text: card.bodyText || ""
                    }),
                    footer: WAProto.Message.InteractiveMessage.Footer.create({
                        text: card.footerText || ""
                    }),
                    nativeFlowMessage: WAProto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: (card.buttons || []).map((btn) => ({
                            name: btn.name,
                            buttonParamsJson: JSON.stringify(btn.params || {})
                        }))
                    })
                };
            }
        })
    );

    const msg = await this.utils.generateWAMessageFromContent(
        jid,
        {
            viewOnceMessage: {
                message: {
                    interactiveMessage: WAProto.Message.InteractiveMessage.create({
                        body: WAProto.Message.InteractiveMessage.Body.create({ text: caption }),
                        footer: WAProto.Message.InteractiveMessage.Footer.create({ text: footer }),
                        carouselMessage: WAProto.Message.InteractiveMessage.CarouselMessage.create({
                            cards: carouselCards,
                            messageVersion: 1
                        })
                    })
                }
            }
        },
        { quoted }
    );

    await this.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
}

    async handlePayment(content, quoted) {
        const data = content.requestPaymentMessage;
        let notes = {};

        if (data.sticker?.stickerMessage) {
            notes = {
                stickerMessage: {
                    ...data.sticker.stickerMessage,
                    contextInfo: {
                        stanzaId: quoted?.key?.id,
                        participant: quoted?.key?.participant || content.sender,
                        quotedMessage: quoted?.message
                    }
                }
            };
        } else if (data.note) {
            notes = {
                extendedTextMessage: {
                    text: data.note,
                    contextInfo: {
                        stanzaId: quoted?.key?.id,
                        participant: quoted?.key?.participant || content.sender,
                        quotedMessage: quoted?.message
                    }
                }
            };
        }

        return {
            requestPaymentMessage: WAProto.Message.RequestPaymentMessage.fromObject({
                expiryTimestamp: data.expiry || 0,
                amount1000: data.amount || 0,
                currencyCodeIso4217: data.currency || "IDR",
                requestFrom: data.from || "0@s.whatsapp.net",
                noteMessage: notes,
                background: data.background ?? {
                    id: "DEFAULT",
                    placeholderArgb: 0xFFF0F0F0
                }
            })
        };
    }

    async handleProduct(content, jid, quoted) {
        const {
            title, 
            description, 
            thumbnail,
            productId, 
            retailerId, 
            url, 
            body = "", 
            footer = "", 
            buttons = []
        } = content.productMessage;

        const { imageMessage } = await this.utils.generateWAMessageContent(
            { image: { url: thumbnail }}, 
            { upload: this.waUploadToServer }
        );

        return {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: body },
                        footer: { text: footer },
                        header: {
                            title,
                            hasMediaAttachment: true,
                            productMessage: {
                                product: {
                                    productImage: imageMessage,
                                    productId,
                                    title,
                                    description,
                                    currencyCode: "IDR",
                                    priceAmount1000: null,
                                    retailerId,
                                    url,
                                    productImageCount: 1
                                },
                                businessOwnerJid: "0@s.whatsapp.net"
                            }
                        },
                        nativeFlowMessage: { buttons }
                    }
                }
            }
        };
    }

    async handleInteractive(content, jid, quoted) {
        const {
            title,
            footer,
            thumbnail,
            buttons = [],
            nativeFlowMessage
        } = content.interactiveMessage;

        if (thumbnail) {
            const media = await this.utils.prepareWAMessageMedia(
                { image: { url: thumbnail } },
                { upload: this.waUploadToServer }
            );
            
            return {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2
                        },
                        interactiveMessage: WAProto.Message.InteractiveMessage.create({
                            body: { text: title },
                            footer: { text: footer },
                            header: {
                                title: "",
                                hasMediaAttachment: true,
                                ...media
                            },
                            nativeFlowMessage: nativeFlowMessage || { buttons }
                        })
                    }
                }
            };
        }

        return {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: WAProto.Message.InteractiveMessage.create({
                        body: { text: title },
                        footer: { text: footer },
                        header: {
                            title: "",
                            hasMediaAttachment: false
                        },
                        nativeFlowMessage: nativeFlowMessage || { buttons }
                    })
                }
            }
        };
    }

    async handleAlbum(content, jid, quoted) {
        const array = content.albumMessage;
        const album = await this.utils.generateWAMessageFromContent(jid, {
            messageContextInfo: {
                messageSecret: crypto.randomBytes(32),
            },
            albumMessage: {
                expectedImageCount: array.filter((a) => a.hasOwnProperty("image")).length,
                expectedVideoCount: array.filter((a) => a.hasOwnProperty("video")).length,
            },
        }, {
            userJid: this.utils.generateMessageID().split('@')[0] + '@s.whatsapp.net',
            quoted,
            upload: this.waUploadToServer
        });

        await this.relayMessage(jid, album.message, {
            messageId: album.key.id,
        });

        for (let content of array) {
            const img = await this.utils.generateWAMessage(jid, content, {
                upload: this.waUploadToServer,
            });

            img.message.messageContextInfo = {
                messageSecret: crypto.randomBytes(32),
                messageAssociation: {
                    associationType: 1,
                    parentMessageKey: album.key,
                },    
                participant: "0@s.whatsapp.net",
                remoteJid: "status@broadcast",
                forwardingScore: 99999,
                isForwarded: true,
                mentionedJid: [jid],
                starred: true,
                labels: ["Y", "Important"],
                isHighlighted: true,
                businessMessageForwardInfo: {
                    businessOwnerJid: jid,
                },
                dataSharingContext: {
                    showMmDisclosure: true,
                },
            };

            img.message.forwardedNewsletterMessageInfo = {
                newsletterJid: "0@newsletter",
                serverMessageId: 1,
                newsletterName: `WhatsApp`,
                contentType: 1,
                timestamp: new Date().toISOString(),
                senderName: "Riyoo",
                content: "Message",
                priority: "high",
                status: "sent",
            };

            img.message.disappearingMode = {
                initiator: 3,
                trigger: 4,
                initiatorDeviceJid: jid,
                initiatedByExternalService: true,
                initiatedByUserDevice: true,
                initiatedBySystem: true,
                initiatedByServer: true,
                initiatedByAdmin: true,
                initiatedByUser: true,
                initiatedByApp: true,
                initiatedByBot: true,
                initiatedByMe: true,
            };

            await this.relayMessage(jid, img.message, {
                messageId: img.key.id,
                quoted: {
                    key: {
                        remoteJid: album.key.remoteJid,
                        id: album.key.id,
                        fromMe: true,
                        participant: this.utils.generateMessageID().split('@')[0] + '@s.whatsapp.net',
                    },
                    message: album.message,
                },
            });
        }
        return album;
    }   
    // tama tama
    async handleEvent(content, jid, quoted) {
        const eventData = content.eventMessage;
        
        const msg = await this.utils.generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2,
                        messageSecret: crypto.randomBytes(32),
                        supportPayload: JSON.stringify({
                            version: 2,
                            is_ai_message: true,
                            should_show_system_message: true,
                            ticket_id: crypto.randomBytes(16).toString('hex')
                        })
                    },
                    eventMessage: {
                        contextInfo: {
                            mentionedJid: [jid],
                            participant: jid,
                            remoteJid: "status@broadcast",
                            forwardedNewsletterMessageInfo: {
                                newsletterName: "Riyoo",
                                newsletterJid: "120363402999071772@newsletter",
                                serverMessageId: 1
                            }
                        },
                        isCanceled: eventData.isCanceled || false,
                        name: eventData.name,
                        description: eventData.description,
                        location: eventData.location || {
                            degreesLatitude: 0,
                            degreesLongitude: 0,
                            name: "Location"
                        },
                        joinLink: eventData.joinLink || '',
                        startTime: typeof eventData.startTime === 'string' ? parseInt(eventData.startTime) : eventData.startTime || Date.now(),
                        endTime: typeof eventData.endTime === 'string' ? parseInt(eventData.endTime) : eventData.endTime || Date.now() + 3600000,
                        extraGuestsAllowed: eventData.extraGuestsAllowed !== false
                    }
                }
            }
        }, { quoted });
        
        await this.relayMessage(jid, msg.message, {
            messageId: msg.key.id
        });
        return msg;
    }
        
    async handlePollResult(content, jid, quoted) {
        const pollData = content.pollResultMessage;
        
        const msg = await this.utils.generateWAMessageFromContent(jid, {
            pollResultSnapshotMessage: {
                name: pollData.name,
                pollVotes: pollData.pollVotes.map(vote => ({
                    optionName: vote.optionName,
                    optionVoteCount: typeof vote.optionVoteCount === 'number' 
                    ? vote.optionVoteCount.toString() 
                    : vote.optionVoteCount
                }))
            }
        }, {
            userJid: this.utils.generateMessageID().split('@')[0] + '@s.whatsapp.net',
            quoted
        });
        
        await this.relayMessage(jid, msg.message, {
            messageId: msg.key.id
        });
       
        return msg;
    }
}

module.exports = hydra;