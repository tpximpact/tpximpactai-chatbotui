import { useRef, useState, useEffect, useContext, useLayoutEffect } from "react";
import { CommandBarButton, IconButton, Dialog, DialogType, Stack, Modal, buttonProperties } from "@fluentui/react";
import { SquareRegular, ShieldLockRegular, ErrorCircleRegular, Dismiss12Regular, Dismiss16Regular } from "@fluentui/react-icons";

import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm'
import rehypeRaw from "rehype-raw";
import uuid from 'react-uuid';
import { isEmpty, set } from "lodash-es";
import DOMPurify from 'dompurify';

import styles from "./Chat.module.css";
import SecondaryXCropped from  "../../assets/Secondary X Cropped.png";
import Butterfly from  "../../assets/tpxbutterflypurple.png";


import { XSSAllowTags } from "../../constants/xssAllowTags";
import arrowLeft from "../../assets/fatarrowleft.png";
import arrowRight from "../../assets/fatarrowright.png";



import {
    ChatMessage,
    ConversationRequest,
    conversationApi,
    Citation,
    ToolMessageContent,
    ChatResponse,
    getUserInfo,
    Conversation,
    historyGenerate,
    historyUpdate,
    historyClear,
    ChatHistoryLoadingState,
    CosmosDBStatus,
    ErrorMessage,
} from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ChatHistoryPanel } from "../../components/ChatHistory/ChatHistoryPanel";
import { AppStateContext } from "../../state/AppProvider";
import { useBoolean } from "@fluentui/react-hooks";
import GuideanceModal from "../../components/GuidanceModal/GuidedanceModal";
import DocumentSummaryModal from "../../components/DocumentSummary/DocumentSummaryModal";
import Loading from "../../components/Loading";

const enum messageStatus {
    NotRunning = "Not Running",
    Processing = "Processing",
    Done = "Done"
}

const Chat = () => {
    const appStateContext = useContext(AppStateContext)
    const ui = appStateContext?.state.frontendSettings?.ui;
    const dev_mode = appStateContext?.state.frontendSettings?.dev_mode;
    const AUTH_ENABLED = appStateContext?.state.frontendSettings?.auth_enabled;
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [chatHistoryLoading, setChatHistoryLoading] = useState<boolean>(false);
    const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false);
    const [activeCitation, setActiveCitation] = useState<Citation>();
    const [isCitationPanelOpen, setIsCitationPanelOpen] = useState<boolean>(false);
    const abortFuncs = useRef([] as AbortController[]);
    const [showAuthMessage, setShowAuthMessage] = useState<boolean>(true);
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [processMessages, setProcessMessages] = useState<messageStatus>(messageStatus.NotRunning);
    const [clearingChat, setClearingChat] = useState<boolean>(false);
    const [hideErrorDialog, { toggle: toggleErrorDialog }] = useBoolean(true);
    const [errorMsg, setErrorMsg] = useState<ErrorMessage | null>()
    const [filenames, setFilenames] = useState<string[]>([]);

    const errorDialogContentProps = {
        type: DialogType.close,
        title: errorMsg?.title,
        closeButtonAriaLabel: 'Close',
        subText: errorMsg?.subtitle,
        styles: { subText: { fontFamily:'DMSans-Regular' }, title: { fontFamily:'PlayfairDisplay-Regular' }, inner: { fontFamily:'DMSans-Regular' }, content: { fontFamily:'DMSans-Regular'}},

    };

    const modalProps = {
        titleAriaId: 'labelId',
        subtitleAriaId: 'subTextId',
        isBlocking: true,
        styles: { main: { maxWidth: 450, borderRadius:'20px' } },
    }

    const [ASSISTANT, TOOL, ERROR] = ["assistant", "tool", "error"]

    useEffect(() => {
        if (appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.Working  
            && appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured
            && appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Fail 
            && hideErrorDialog) {
            let subtitle = `${appStateContext.state.isCosmosDBAvailable.status}. Please contact the site administrator.`
            setErrorMsg({
                title: "Chat history is not enabled",
                subtitle: subtitle
            })
            toggleErrorDialog();
        }
    }, [appStateContext?.state.isCosmosDBAvailable]);

    const handleErrorDialogClose = () => {
        toggleErrorDialog()
        setTimeout(() => {
            setErrorMsg(null)
        }, 500);
    }

    useEffect(() => {
        const historyLoading  = appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading
        setChatHistoryLoading(historyLoading)
        setIsLoading(historyLoading)
        if (!appStateContext?.state.isChatHistoryOpen){
            appStateContext?.dispatch({ type: 'TOGGLE_CHAT_HISTORY' })
        }

    }, [appStateContext?.state.chatHistoryLoadingState])

    const getUserInfoList = async () => {
        if (!AUTH_ENABLED) {
            setShowAuthMessage(false);
            return;
        }
        const userInfoList = await getUserInfo();
        if (userInfoList.length === 0 && window.location.hostname !== "127.0.0.1") {
            setShowAuthMessage(true);
        }
        else {
            setShowAuthMessage(false);
        }
    }

    let assistantMessage = {} as ChatMessage
    let toolMessage = {} as ChatMessage
    let assistantContent = ""

    const processResultMessage = (resultMessage: ChatMessage, userMessage: ChatMessage, conversationId?: string) => {
        if (resultMessage.role === ASSISTANT) {
            assistantContent += resultMessage.content
            assistantMessage = resultMessage
            assistantMessage.content = assistantContent
            if (resultMessage.context) {
                toolMessage = {
                    id: uuid(),
                    role: TOOL,
                    content: resultMessage.context,
                    date: new Date().toISOString(),
                }
            }
        }

        if (resultMessage.role === TOOL) toolMessage = resultMessage
        if (!conversationId) {
            isEmpty(toolMessage) ?
                setMessages([...messages, userMessage, assistantMessage]) :
                setMessages([...messages, userMessage, toolMessage, assistantMessage]);
        } else {
            isEmpty(toolMessage) ?
                setMessages([...messages, assistantMessage]) :
                setMessages([...messages, toolMessage, assistantMessage]);
        }

    }

    const makeApiRequestWithoutCosmosDB = async (question: string, conversationId?: string, hidden?: boolean) => {
        setIsLoading(true);
        setShowLoadingMessage(true);
        const abortController = new AbortController();
        abortFuncs.current.unshift(abortController);
        const userMessage: ChatMessage = {
            id: uuid(),
            role: "user",
            content: question,
            date: new Date().toISOString(),
            hidden: hidden ? hidden : false
        };

        let conversation: Conversation | null | undefined;
        if (!conversationId) {
            conversation = {
                id: conversationId ?? uuid(),
                title: question,
                messages: [userMessage],
                date: new Date().toISOString(),
            }
        } else {
            conversation = appStateContext?.state?.currentChat
            if (!conversation) {
                console.error("Conversation not found.");
                setIsLoading(false);
                setShowLoadingMessage(false);
                abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                return;
            } else {
                conversation.messages.push(userMessage);
            }
        }

        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation });
        setMessages(conversation.messages)

        const request: ConversationRequest = {
            messages: [...conversation.messages.filter((answer) => answer.role !== ERROR)],
        };

        let result = {} as ChatResponse;
        try {
            const response = await conversationApi(request, abortController.signal);
            if (response?.body) {
                const reader = response.body.getReader();

                let runningText = "";
                while (true) {
                    setProcessMessages(messageStatus.Processing)
                    const { done, value } = await reader.read();
                    if (done) break;

                    var text = new TextDecoder("utf-8").decode(value);
                    const objects = text.split("\n");
                    objects.forEach((obj) => {
                        try {
                            if (obj !== "" && obj !== "{}") {
                                runningText += obj;
                                result = JSON.parse(runningText);
                                if (result.choices?.length > 0) {
                                    result.choices[0].messages.forEach((msg) => {
                                        msg.id = result.id;
                                        msg.date = new Date().toISOString();
                                    })
                                    if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                                        setShowLoadingMessage(false);
                                    }
                                    result.choices[0].messages.forEach((resultObj) => {
                                        processResultMessage(resultObj, userMessage, conversationId);
                                    })
                                }
                                else if (result.error) {
                                    throw Error(result.error);
                                }
                                runningText = "";
                            }
                        }
                        catch (e) {
                            if (!(e instanceof SyntaxError)) {
                                console.error(e);
                                throw e;
                            } else {
                                console.log("Incomplete message. Continuing...")
                            }
                        }
                    });
                }
                conversation.messages.push(toolMessage, assistantMessage)
                appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation });
                setMessages([...messages, toolMessage, assistantMessage]);
            }

        } catch (e) {
            if (!abortController.signal.aborted) {
                let errorMessage = "An error occurred. Please try again. If the problem persists, please contact the site administrator.";
                if (result.error?.message) {
                    errorMessage = result.error.message;
                }
                else if (typeof result.error === "string") {
                    errorMessage = result.error;
                }
                let errorChatMsg: ChatMessage = {
                    id: uuid(),
                    role: ERROR,
                    content: errorMessage,
                    date: new Date().toISOString()
                }
                conversation.messages.push(errorChatMsg);
                appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation });
                setMessages([...messages, errorChatMsg]);
            } else {
                setMessages([...messages, userMessage])
            }
        } finally {
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
            setProcessMessages(messageStatus.Done)
        }

        return abortController.abort();
    };

    const makeApiRequestWithCosmosDB = async (question: string, conversationId?: string, hidden?: boolean) => {
        setIsLoading(true);
        setShowLoadingMessage(true);
        const abortController = new AbortController();
        abortFuncs.current.unshift(abortController);
        const userMessage: ChatMessage = {
            id: uuid(),
            role: "user",
            content: question,
            date: new Date().toISOString(),
            hidden: hidden ? hidden : false
        };

        //api call params set here (generate)
        let request: ConversationRequest;
        let conversation;
        if (conversationId) {
            conversation = appStateContext?.state?.chatHistory?.find((conv) => conv.id === conversationId)
            if (!conversation) {
                console.error("Conversation not found.");
                setIsLoading(false);
                setShowLoadingMessage(false);
                abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                return;
            } else {
                conversation.messages.push(userMessage);
                request = {
                    messages: [...conversation.messages.filter((answer) => answer.role !== ERROR)],
                    filenames: filenames && !hidden ? filenames : []
                };
            }
        } else {
            request = {
                messages: [userMessage].filter((answer) => answer.role !== ERROR),
                filenames: filenames && !hidden ? filenames : []
            };
            setMessages(request.messages)
        }
        let result = {} as ChatResponse;
        try {
            const response = conversationId ? await historyGenerate(request, abortController.signal, conversationId) : await historyGenerate(request, abortController.signal);
            if (!response?.ok) {
                const responseJson = await response.json();
                var errorResponseMessage = responseJson.error === undefined ? "Please try again. If the problem persists, please contact the site administrator." : responseJson.error;
                const errorMessageContent = responseJson
                const jsonStartIndex = errorResponseMessage.indexOf("{");

                // Extract the JSON string
                const jsonString = errorResponseMessage.substring(jsonStartIndex);
                console.log('json string:', jsonString)
                const validJsonString = jsonString.replace(/(\w+)'(\s*:\s*)'([^']+)'/g, '"$1"$2"$3"')
                .replace(/'(\w+)':/g, '"$1":');                
                console.log('json valid string', validJsonString)
                // Parse the JSON string
                try{

                    const jsonError = JSON.parse(validJsonString);
                    console.log(jsonError)
                    console.log(jsonError.code)
    
                }
                catch( e) {
                    console.log(e)
                }
                
                let errorChatMsg: ChatMessage = {
                    id: uuid(),
                    role: ERROR,
                    content: `There was an error generating a response. Chat history can't be saved at this time. ${errorResponseMessage}`,
                    date: new Date().toISOString()
                }
                let resultConversation;
                if (conversationId) {
                    resultConversation = appStateContext?.state?.chatHistory?.find((conv) => conv.id === conversationId)
                    if (!resultConversation) {
                        console.error("Conversation not found.");
                        setIsLoading(false);
                        setShowLoadingMessage(false);
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                        return;
                    }
                    resultConversation.messages.push(errorChatMsg);
                } else {
                    setMessages([...messages, userMessage, errorChatMsg])
                    setIsLoading(false);
                    setShowLoadingMessage(false);
                    abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                    return;
                }
                appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation });
                setMessages([...resultConversation.messages]);
                return;
            }
            if (response?.body) {
                const reader = response.body.getReader();

                let runningText = "";
                while (true) {
                    setProcessMessages(messageStatus.Processing)
                    const { done, value } = await reader.read();
                    if (done) break;

                    var text = new TextDecoder("utf-8").decode(value);
                    const objects = text.split("\n");
                    objects.forEach((obj) => {
                        try {
                            if (obj !== "" && obj !== "{}") {
                                runningText += obj;
                                result = JSON.parse(runningText);
                                if (result.choices?.length > 0) {
                                    result.choices[0].messages.forEach((msg) => {
                                        msg.id = result.id;
                                        msg.date = new Date().toISOString();
                                    })
                                    if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                                        setShowLoadingMessage(false);
                                    }
                                    result.choices[0].messages.forEach((resultObj) => {
                                        processResultMessage(resultObj, userMessage, conversationId);
                                    })
                                }
                                runningText = "";
                            }
                            else if (result.error) {
                                throw Error(result.error);
                            }
                        }
                        catch (e) {
                            if (!(e instanceof SyntaxError)) {
                                console.error(e);
                                throw e;
                            } else {
                                console.log("Incomplete message. Continuing...")
                            }
                         }
                    });
                }

                let resultConversation;
                if (conversationId) {
                    resultConversation = appStateContext?.state?.chatHistory?.find((conv) => conv.id === conversationId)
                    if (!resultConversation) {
                        console.error("Conversation not found.");
                        setIsLoading(false);
                        setShowLoadingMessage(false);
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                        return;
                    }
                    isEmpty(toolMessage) ?
                        resultConversation.messages.push(assistantMessage) :
                        resultConversation.messages.push(toolMessage, assistantMessage)
                } else {
                    resultConversation = {
                        id: result.history_metadata.conversation_id,
                        title: result.history_metadata.title,
                        messages: [userMessage],
                        date: result.history_metadata.date
                    }
                    isEmpty(toolMessage) ?
                        resultConversation.messages.push(assistantMessage) :
                        resultConversation.messages.push(toolMessage, assistantMessage)
                }
                if (!resultConversation) {
                    setIsLoading(false);
                    setShowLoadingMessage(false);
                    abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                    return;
                }
                appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation });
                isEmpty(toolMessage) ?
                    setMessages([...messages, assistantMessage]) :
                    setMessages([...messages, toolMessage, assistantMessage]);
            }

        } catch (e) {
            if (!abortController.signal.aborted) {
                let errorMessage = `An error occurred. ${errorResponseMessage}`;
                if (result.error?.message) {
                    errorMessage = result.error.message;
                }
                else if (typeof result.error === "string") {
                    errorMessage = result.error;
                }
                let errorChatMsg: ChatMessage = {
                    id: uuid(),
                    role: ERROR,
                    content: errorMessage,
                    date: new Date().toISOString()
                }
                let resultConversation;
                if (conversationId) {
                    resultConversation = appStateContext?.state?.chatHistory?.find((conv) => conv.id === conversationId)
                    if (!resultConversation) {
                        console.error("Conversation not found.");
                        setIsLoading(false);
                        setShowLoadingMessage(false);
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                        return;
                    }
                    resultConversation.messages.push(errorChatMsg);
                } else {
                    if (!result.history_metadata) {
                        console.error("Error retrieving data.", result);
                        let errorChatMsg: ChatMessage = {
                            id: uuid(),
                            role: ERROR,
                            content: errorMessage,
                            date: new Date().toISOString()
                        } 
                        setMessages([...messages, userMessage, errorChatMsg])
                        setIsLoading(false);
                        setShowLoadingMessage(false);
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                        return;
                    }
                    resultConversation = {
                        id: result.history_metadata.conversation_id,
                        title: result.history_metadata.title,
                        messages: [userMessage],
                        date: result.history_metadata.date
                    }
                    resultConversation.messages.push(errorChatMsg);
                }
                if (!resultConversation) {
                    setIsLoading(false);
                    setShowLoadingMessage(false);
                    abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
                    return;
                }
                appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation });
                setMessages([...messages, errorChatMsg]);
            } else {
                setMessages([...messages, userMessage])
            }
        } finally {
            setIsLoading(false);
            setShowLoadingMessage(false);
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController);
            setProcessMessages(messageStatus.Done)
        }
        return abortController.abort();

    }

    const clearChat = async () => {
        setClearingChat(true)
        if (appStateContext?.state.currentChat?.id && appStateContext?.state.isCosmosDBAvailable.cosmosDB) {
            let response = await historyClear(appStateContext?.state.currentChat.id)
            if (!response.ok) {
                setErrorMsg({
                    title: "Error clearing current chat",
                    subtitle: "Please try again. If the problem persists, please contact the site administrator.",
                })
                toggleErrorDialog();
            } else {
                appStateContext?.dispatch({ type: 'DELETE_CURRENT_CHAT_MESSAGES', payload: appStateContext?.state.currentChat.id });
                appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext?.state.currentChat });
                setActiveCitation(undefined);
                setIsCitationPanelOpen(false);
                setMessages([])
            }
        }
        setClearingChat(false)
    };

    const newChat = () => {
        setProcessMessages(messageStatus.Processing)
        setMessages([])
        setIsCitationPanelOpen(false);
        setActiveCitation(undefined);
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: null });
        setProcessMessages(messageStatus.Done)
    };

    const stopGenerating = () => {
        abortFuncs.current.forEach(a => a.abort());
        setShowLoadingMessage(false);
        setIsLoading(false);
    }

    useEffect(() => {
        if (appStateContext?.state.currentChat) {
            setMessages(appStateContext.state.currentChat.messages)
        } else {
            setMessages([])
        }
    }, [appStateContext?.state.currentChat]);

    useLayoutEffect(() => {
        const saveToDB = async (messages: ChatMessage[], id: string) => {
            const response = await historyUpdate(messages, id)
            return response
        }

        if (appStateContext && appStateContext.state.currentChat && processMessages === messageStatus.Done) {
            if (appStateContext.state.isCosmosDBAvailable.cosmosDB) {
                if (!appStateContext?.state.currentChat?.messages) {
                    console.error("Failure fetching current chat state.")
                    return
                }
                saveToDB(appStateContext.state.currentChat.messages, appStateContext.state.currentChat.id)
                    .then((res) => {
                        if (!res.ok) {
                            let errorMessage = "An error occurred. Answers can't be saved at this time. If the problem persists, please contact the site administrator.";
                            let errorChatMsg: ChatMessage = {
                                id: uuid(),
                                role: ERROR,
                                content: errorMessage,
                                date: new Date().toISOString()
                            }
                            if (!appStateContext?.state.currentChat?.messages) {
                                let err: Error = {
                                    ...new Error,
                                    message: "Failure fetching current chat state."
                                }
                                throw err
                            }
                            setMessages([...appStateContext?.state.currentChat?.messages, errorChatMsg])
                        }
                        return res as Response
                    })
                    .catch((err) => {
                        console.error("Error: ", err)
                        let errRes: Response = {
                            ...new Response,
                            ok: false,
                            status: 500,
                        }
                        return errRes;
                    })
            } else {
            }
            appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext.state.currentChat });
            setMessages(appStateContext.state.currentChat.messages)
            setProcessMessages(messageStatus.NotRunning)
        }
    }, [processMessages]);

    useEffect(() => {
        if (AUTH_ENABLED !== undefined) getUserInfoList();
    }, [AUTH_ENABLED]);

    useLayoutEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" })
    }, [showLoadingMessage, processMessages]);

    const onShowCitation = (citation: Citation) => {
        setActiveCitation(citation);
        setIsCitationPanelOpen(true);
    };

    const onViewSource = (citation: Citation) => {
        if (citation.url && !citation.url.includes("blob.core")) {
            window.open(citation.url, "_blank");
        }
    };

    const parseCitationFromMessage = (message: ChatMessage) => {
        if (message?.role && message?.role === "tool") {
            try {
                const toolMessage = JSON.parse(message.content) as ToolMessageContent;
                return toolMessage.citations;
            }
            catch {
                return [];
            }
        }
        return [];
    }

    const disabledButton = () => {
        return isLoading || (messages && messages.length === 0) || clearingChat || appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading
    }
    const handleHistoryClick = () => {
        appStateContext?.dispatch({ type: 'TOGGLE_CHAT_HISTORY' })
    };

    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => {
    //   setIsModalOpen(true);
    window.open("https://docs.google.com/document/d/1VTs09xtQziGbRNg-wHpTuJR7VBnATOujTtxrADG9g6s", "_blank");
    };
  
    const closeModal = () => {
      setIsModalOpen(false);
    };
        

    const [isHModalOpen, setIsHModalOpen] = useState(false);

    const openHModal = () => {
      setIsHModalOpen(true);
    };
  
    const closeHModal = () => {
      setIsHModalOpen(false);
    };

    const [isDocSumModalOpen, setIsDocSumModalOpen] = useState(false);

    const openDocSumModal = () => {
      setIsDocSumModalOpen(true);
    };

    const closeDocSumModal = () => {
      setIsDocSumModalOpen(false);
    };

    return (
        <div className={styles.container} role="main">
            {showAuthMessage ? (
                <Stack horizontal className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    <Stack className={styles.chatEmptyState}>
                        <h2 className={styles.chatEmptyStateSubtitle}>
                            To access the chat, please close this browser window and open a new one.
                            If the problem persists after a few minutes, contact your administrator.
                        </h2>
                    </Stack>
                </div>
            </Stack>
            ) : (
                <Stack horizontal className={styles.chatRoot}>

                    {(appStateContext?.state.isChatHistoryOpen && appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured) && <ChatHistoryPanel />}

                    <div className={styles.chatContainer}>

                    <div
                        style={{
                            transform: 'scaleX(0.7)',
                            position: "absolute",
                            top: '45%',
                            left: "0px",
                            display: appStateContext?.state?.isChatHistoryOpen ? "none" : "block",
                        }}
                        >
                        {(appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured) && (
                            <img
                            onClick={handleHistoryClick}

                            src={appStateContext?.state?.isChatHistoryOpen ? arrowLeft : arrowRight}
                            alt="Arrow"
                            style={{ width: '70px', height: 'auto',cursor: 'pointer', padding:'20px'}}
                            />
                        )}
                        </div>
                        {!messages || messages.length < 1 ? (
                            <Stack className={styles.chatEmptyState}>
                                <div style = {{display:'flex', flexDirection:'row', position:'relative'}}>
                                    <div style = {{display:'flex', flexDirection:'column'}}>
                                        <span className={styles.chatEmptyStatePreTitle}>{ui?.chat_pre_title}</span>
                                        <span className={styles.chatEmptyStateTitle}>{ui?.chat_title}</span>
                                    </div>

                                <img
                                    src={ui?.chat_logo ? ui.chat_logo : SecondaryXCropped}
                                    className={styles.chatIcon}
                                    aria-hidden="true"
                                    />
                                    <img
                                    src={ui?.chat_logo ? ui.chat_logo : Butterfly}
                                    className={styles.chatIconSecondary}
                                    aria-hidden="true"
                                />

                                </div>
                                <h2 className={styles.chatEmptyStateSubtitle}>

                                {ui?.chat_description ? (
                                    <>
                                    {ui.chat_description}
                                    </>
                                ) : (
                                    <>
                                    {dev_mode ? "DEV MODE. " : null}This is a private instance of ChatGPT, so you can ask questions involving sensitive or confidential data.<br/> Please read our 
                                    <a onClick={openModal} href="#" >Generative AI Guidance</a>
                                    document before using this tool.
                                    <p>
                                    If you need any help, check out the examples at top right.
                                    </p>
                                    <p>
                                    For any further support please use the Slack channel<a href="https://tpximpact.slack.com/archives/C06RLPS8NH1" target='_blank'>#tpx_cop-ai</a>
                                    </p>
                                    </>
                                )}
                                </h2>
                                <GuideanceModal
                                    isOpen={isModalOpen}
                                    onClose={closeModal}
                                />
                            </Stack>

                        ) : (
                            <div className={styles.chatMessageStream} style={{ marginBottom: isLoading ? "40px" : "0px" }} role="log">
                                {messages.map((answer, index) => (
                                    <>
                                        {answer.role === "user" && !answer.hidden ? (
                                            <div className={styles.chatMessageUser} tabIndex={0}>
                                                <div className={styles.chatMessageUserMessage}>{answer.content}</div>
                                            </div>
                                        ) : (
                                            answer.role === "assistant" ? <div className={styles.chatMessageGpt}>
                                                <Answer
                                                    answer={{
                                                        answer: answer.content,
                                                        citations: parseCitationFromMessage(messages[index - 1]),
                                                        message_id: answer.id,
                                                        feedback: answer.feedback
                                                    }}
                                                    onCitationClicked={c => onShowCitation(c)}
                                                />
                                            </div> : answer.role === ERROR ? <div className={styles.chatMessageError}>
                                                <Stack horizontal className={styles.chatMessageErrorContent}>
                                                    <ErrorCircleRegular className={styles.errorIcon} style={{ color: "rgba(182, 52, 67, 1)" }} />
                                                    <span>Error</span>
                                                </Stack>
                                                <span className={styles.chatMessageErrorContent}>{answer.content}</span>
                                            </div> : null
                                        )}
                                    </>
                                ))}
                                {showLoadingMessage && (
                                    <>
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                answer={{
                                                    answer: "Generating answer...",
                                                    citations: []
                                                }}
                                                onCitationClicked={() => null}
                                            />
                                        </div>
                                    </>
                                )}
                                <div ref={chatMessageStreamEnd} />
                            </div>
                        )}

                        <Stack horizontal className={styles.chatInput}>
                            <div className= {styles.statusBarContainer}>

                            {filenames.length! > 0 && (
                                <Stack
                                horizontal
                                className={styles.askingQuestionsContainer}
                                role="button"
                                aria-label="Stop generating"
                                tabIndex={0}
                                onClick={() => {setFilenames([])}}
                                onKeyDown={e => e.key === "Enter" || e.key === " " ? setFilenames([]) : null}
                            >
                                <span className={styles.askingQuestionsText} aria-hidden="true">
                                    Asking questions about 
                                </span>

                                {filenames.length == 1 ? 
                                    <span className ={styles.stopGeneratingText} aria-hidden="true">
                                        {filenames[0]}
                                    </span>
                                :
                                    <>
                                    <span className ={styles.stopGeneratingText} aria-hidden="true">
                                        {filenames.length}
                                    </span>
                                    <span className={styles.askingQuestionsText} aria-hidden="true">
                                        documents
                                    </span>
                                    </>
                                }

                                <Dismiss12Regular className={styles.stopGeneratingIcon} aria-hidden="true" />
                            </Stack>
                            
                            )}
                            {(isLoading && !chatHistoryLoading) && (
                                <Stack
                                    horizontal
                                    className={styles.stopGeneratingContainer}
                                    role="button"
                                    aria-label="Stop generating"
                                    tabIndex={1}
                                    onClick={stopGenerating}
                                    onKeyDown={e => e.key === "Enter" || e.key === " " ? stopGenerating() : null}
                                >
                                    <SquareRegular className={styles.stopGeneratingIcon} aria-hidden="true" />
                                    <span className={styles.stopGeneratingText} aria-hidden="true">Stop generating</span>
                                </Stack>
                            )}
                            {chatHistoryLoading && (
                              <div className={styles.chatHistoryLoading}>
                                <span className={styles.stopGeneratingText} style= {{marginRight:'2px'}}>Loading chat history</span>
                                <Loading size={15} color="#000000" />

                              </div>
                            )}
                            </div>
       
                            <Stack>
                                {appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && <CommandBarButton
                                    role="button"
                                    styles={{
                                        icon: {
                                            color: 'black',
                                        },
                                        iconHovered: {
                                            color: 'black',
                                        },
                                        iconDisabled: {
                                            color: "#BDBDBD !important",
                                        },
                                        root: {
                                            background: "#FFFFFF"
                                        },
                                        rootHovered: {
                                            background: '#cafce5',
                                        },
                                        rootDisabled: {
                                            background: "#F0F0F0"
                                        }
                                    }}
                                    className={styles.newChatIcon}
                                    iconProps={{ iconName: 'SingleColumnEdit' }}
                                    onClick={newChat}
                                    disabled={disabledButton()}
                                    aria-label="start a new chat button"
                                />}
                                <CommandBarButton
                                    role="button"
                                    styles={{
                                        icon: {
                                            color: 'black',
                                        },
                                        iconHovered: {
                                            color: 'black',
                                        },
                                        iconDisabled: {
                                            color: "#BDBDBD !important",
                                        },
                                        root: {
                                            background: "#FFFFFF"
                                        },
                                        rootHovered: {
                                            background: '#ffcfca',
                                        },
                                        rootDisabled: {
                                            background: "#F0F0F0"
                                        }
                                    }}
                                    className={styles.documentSummaryIcon}
                                    iconProps={{ iconName: 'BulkUpload' }}
                                    onClick={openDocSumModal}
                                    disabled={false}
                                    aria-label="document summary button"
                                />
                                <Dialog
                                    hidden={hideErrorDialog}
                                    onDismiss={handleErrorDialogClose}
                                    dialogContentProps={errorDialogContentProps}
                                    modalProps={modalProps}
                                >
                                </Dialog>
                                <DocumentSummaryModal
                disabled={isLoading}
                isOpen={isDocSumModalOpen}
                onClose={closeDocSumModal}
                onSend={(question, id) => {
                    appStateContext?.state.isCosmosDBAvailable?.cosmosDB ? makeApiRequestWithCosmosDB(question, id, true) : makeApiRequestWithoutCosmosDB(question, id, true)
                }}
                conversationId={appStateContext?.state.currentChat?.id ? appStateContext?.state.currentChat?.id : undefined}
                setFilenames={setFilenames}
                filenames={filenames}
                    />

                            </Stack>
                            <QuestionInput
                                clearOnSend
                                placeholder="Type a new question..."
                                disabled={isLoading}
                                onSend={(question, id) => {
                                    appStateContext?.state.isCosmosDBAvailable?.cosmosDB ? makeApiRequestWithCosmosDB(question, id) : makeApiRequestWithoutCosmosDB(question, id)
                                }}
                                conversationId={appStateContext?.state.currentChat?.id ? appStateContext?.state.currentChat?.id : undefined}
                            />
                            <span style= {{whiteSpace: 'nowrap', overflow:'clip', position:'absolute', bottom:'-45px', color:'black', fontSize:'14px', width:'100%', textAlign:'center'}}> 
                                Always fact-check responses thoroughly for accuracy and
                                <a 
                                    href='#'
                                    onClick={openHModal}
                                    style = {{
                                        color:'blue'
                                    }}
                                    >hallucination.
                                </a>
                            </span>

                        </Stack>
                            <Modal
                                  styles= {{main: {borderRadius:'20px', width:'65%'} } }
                                  isOpen={isHModalOpen}
                                  onDismiss={closeHModal}
                                  isBlocking={false}
                            >
                                <div style= {{padding:'5%'}}>        
                                    <IconButton
                                    
                                        onMouseOver={undefined}
                                        iconProps={{ iconName: 'Cancel', styles: { root: { color: 'black'}}}}
                                        ariaLabel="Close"
                                        onClick={closeHModal}
                                        styles={{ root: { position: 'absolute', top: '10px', right: '10px', borderRadius:'10px'} }}
                                        />

                                    <h3>
                                        What is Hallucination in Gen AI?
                                    </h3>
                                    <p>
                                    Hallucination in Generative AI is when output can sometimes contain false or misleading information that is presented as fact.   
                                    </p>
                                    <p>
                                    <strong>For example:</strong> you ask Generative AI to summarise specific sections within a document, if one of those sections doesn't exist in the document then Generative AI may make up the information and present it as if it is real.
                                    </p>
                                </div>
                            </Modal>
                    </div>
                    {/* Citation Panel */}
                    {messages && messages.length > 0 && isCitationPanelOpen && activeCitation && (
                        <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Citations Panel">
                            <Stack aria-label="Citations Panel Header Container" horizontal className={styles.citationPanelHeaderContainer} horizontalAlign="space-between" verticalAlign="center">
                                <span aria-label="Citations" className={styles.citationPanelHeader}>Citations</span>
                                <IconButton iconProps={{ iconName: 'Cancel', styles: {root: {color:'black'}} }} aria-label="Close citations panel" onClick={() => setIsCitationPanelOpen(false)} />
                            </Stack>
                            <h5 className={styles.citationPanelTitle} tabIndex={0} title={activeCitation.url && !activeCitation.url.includes("blob.core") ? activeCitation.url : activeCitation.title ?? ""} onClick={() => onViewSource(activeCitation)}>{activeCitation.title}</h5>
                            <div tabIndex={0}>
                                <ReactMarkdown
                                    linkTarget="_blank"
                                    className={styles.citationPanelContent}
                                    children={DOMPurify.sanitize(activeCitation.content, {ALLOWED_TAGS: XSSAllowTags})}
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                />
                            </div>
                        </Stack.Item>
                    )}
                </Stack>
            )}
        </div>
    );
};

export default Chat;
