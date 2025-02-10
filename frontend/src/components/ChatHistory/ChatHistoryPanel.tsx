import { CommandBarButton, ContextualMenu, DefaultButton, Dialog, DialogFooter, DialogType, IButtonStyles, ICommandBarStyles, IContextualMenuItem, IDialogContentProps, IStackStyles, PrimaryButton, Spinner, SpinnerSize, Stack, StackItem, Text, mergeStyles } from "@fluentui/react";
import { useBoolean } from '@fluentui/react-hooks';

import styles from "./ChatHistoryPanel.module.css"
import { useContext } from "react";
import { AppStateContext } from "../../state/AppProvider";
import React from "react";
import ChatHistoryList from "./ChatHistoryList";
import { ChatHistoryLoadingState, historyDeleteAll } from "../../api";
import COLOURS from "../../constants/COLOURS";
import { XCircleIcon, EllipsisHorizontalCircleIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ChatHistoryPanelProps {

}

export enum ChatHistoryPanelTabs {
    History = "History"
}


const commandBarStackStyle: Partial<IStackStyles> = {
    root: { 
        height: '40px',
    },
};

const commandBarButtonStyle: Partial<IButtonStyles> = {
    root: { 
        height: '40px',
        padding: '0',
        display: 'flex',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderRadius:'15px'
    },
    rootHovered: {
        backgroundColor: 'rgba(0, 0, 200, 0.1)',
    },
    rootPressed: {
        backgroundColor: 'rgba(0, 0, 200, 0.1)',
    }
};

export function ChatHistoryPanel(props: ChatHistoryPanelProps) {
    const appStateContext = useContext(AppStateContext)
    const [showContextualMenu, setShowContextualMenu] = React.useState(false);
    const [hideClearAllDialog, { toggle: toggleClearAllDialog }] = useBoolean(true);
    const [clearing, setClearing] = React.useState(false)
    const [clearingError, setClearingError] = React.useState(false)

    const clearAllDialogContentProps: IDialogContentProps = {
        type: DialogType.close,
        title: !clearingError? 'Are you sure you want to clear all chat history?' : 'Error deleting all of chat history',
        closeButtonAriaLabel: 'Close',
        subText: !clearingError ? 'All chat history will be permanently removed.' : 'Please try again. If the problem persists, please contact the site administrator.',
        styles: {
            subText: { fontFamily:'DMSans-Regular' }, 
            title: { fontFamily:'PlayfairDisplay-Regular' }, 
            inner: { fontFamily:'DMSans-Regular' }, 
            content: { fontFamily:'DMSans-Regular' },
        },
        topButtonsProps: [
            {
                onRenderIcon: () => <XMarkIcon color="black" height={20} width={20}/>,
                onClick: () => {
                    toggleClearAllDialog()
                },
                style: {
                    zIndex: 10,
                    position: 'absolute',
                    backgroundColor: 'white',
                }
            }
        ]
    };
    
    const modalProps = {
        titleAriaId: 'labelId',
        subtitleAriaId: 'subTextId',
        isBlocking: true,
        styles: { main: { maxWidth: 450, borderRadius:'20px', fontFamily:'DMSans-Regular', padding: '10px' }},

    }

    const menuItems: IContextualMenuItem[] = [
        { key: 'clearAll', text: 'Clear all chat history', iconProps: { iconName: 'Delete' }, onRenderIcon: () => <TrashIcon color="black" height={17} width={17}/>},
    ];

    const handleHistoryClick = () => {
        appStateContext?.dispatch({ type: 'TOGGLE_CHAT_HISTORY' })
    };
    
    const onShowContextualMenu = React.useCallback((ev: React.MouseEvent<HTMLElement>) => {
        ev.preventDefault(); // don't navigate
        setShowContextualMenu(true);
    }, []);

    const onHideContextualMenu = React.useCallback(() => setShowContextualMenu(false), []);

    const onClearAllChatHistory = async () => {
        setClearing(true)
        let response = await historyDeleteAll()
        if(!response.ok){
            setClearingError(true)
        }else{
            appStateContext?.dispatch({ type: 'DELETE_CHAT_HISTORY' })
            toggleClearAllDialog();
        }
        setClearing(false);
    }

    const onHideClearAllDialog = () => {
        toggleClearAllDialog()
        setTimeout(() => {
            setClearingError(false)
        }, 2000);
    }

    React.useEffect(() => {}, [appStateContext?.state.chatHistory, clearingError]);

    return (
        <section className={styles.container} data-is-scrollable aria-label={"chat history panel"}>
            <Stack horizontal horizontalAlign='space-between' verticalAlign='center' wrap aria-label="chat history header">
                <StackItem>
                    <Text role="heading" aria-level={2} className={styles.panelTitle}>CHAT HISTORY</Text>
                </StackItem>
                <Stack verticalAlign="start">
                    <Stack horizontal styles={commandBarStackStyle}>
                        <CommandBarButton
                            onRenderIcon={() => <EllipsisHorizontalCircleIcon color="white" height={20} width={20}/>}
                            title={"Clear all chat history"}
                            onClick={onShowContextualMenu}
                            aria-label={"clear all chat history"}
                            styles={commandBarButtonStyle}
                            role="button"
                            id="moreButton"
                        />
                        <ContextualMenu
                            items={menuItems}
                            hidden={!showContextualMenu}
                            target={"#moreButton"}
                            onItemClick={toggleClearAllDialog}
                            onDismiss={onHideContextualMenu}
                        />
                    <CommandBarButton
                        onRenderIcon={() => <XCircleIcon color="white" height={20} width={20}/>}
                        title={"Hide"}
                        onClick={handleHistoryClick}
                        aria-label={"hide button"}
                        styles={commandBarButtonStyle}
                        role="button"
                    />                    
                </Stack>
                </Stack>
            </Stack>
            <Stack aria-label="chat history panel content"
                styles={{
                    root: {
                        display: "flex",
                        flexGrow: 1,
                        flexDirection: "column",
                        paddingTop: '2.5px',
                        maxWidth: "100%"
                    },
                }}
                style={{
                    display: "flex",
                    flexGrow: 1,
                    flexDirection: "column",
                    flexWrap: "wrap",
                    padding: "1px"
                }}>
                <Stack className={styles.chatHistoryListContainer}>
                    {(appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Success && appStateContext?.state.isCosmosDBAvailable.cosmosDB) && <ChatHistoryList/>}
                    {(appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Fail && appStateContext?.state.isCosmosDBAvailable) && <>
                        <Stack>
                            <Stack horizontalAlign='center' verticalAlign='center' style={{ width: "100%", marginTop: 10 }}>
                                <StackItem>
                                    <Text style={{ alignSelf: 'center', fontWeight: '400', fontSize: 16 }}>
                                        {appStateContext?.state.isCosmosDBAvailable?.status && <span>{appStateContext?.state.isCosmosDBAvailable?.status}</span>}
                                        {!appStateContext?.state.isCosmosDBAvailable?.status && <span>Error loading chat history</span>}
                                        
                                    </Text>
                                </StackItem>
                                <StackItem>
                                    <Text style={{ alignSelf: 'center', fontWeight: '400', fontSize: 14 }}>
                                        <span>Chat history can't be saved at this time</span>
                                    </Text>
                                </StackItem>
                            </Stack>
                        </Stack>
                    </>}
                    {appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading && <>
                        <Stack>
                            <Stack horizontal horizontalAlign='center' verticalAlign='center' style={{ width: "100%", marginTop: 10 }}>
                                <StackItem style={{ justifyContent: 'center', alignItems: 'center' }}>
                                    <Spinner style={{ alignSelf: "flex-start", height: "100%", marginRight: "5px" }} size={SpinnerSize.medium} />
                                </StackItem>
                                <StackItem>
                                    <Text style={{ alignSelf: 'center', fontWeight: '400', fontSize: 14 }}>
                                        <span style={{ whiteSpace: 'pre-wrap' }}>Loading chat history</span>
                                    </Text>
                                </StackItem>
                            </Stack>
                        </Stack>
                    </>}
                </Stack>
            </Stack>
            <Dialog
                hidden={hideClearAllDialog}
                onDismiss={clearing ? ()=>{} : onHideClearAllDialog}
                dialogContentProps={clearAllDialogContentProps}
                modalProps={modalProps}
            >
                <DialogFooter>
                {!clearingError && <PrimaryButton onClick={onClearAllChatHistory} disabled={clearing} text="Clear All" style={{backgroundColor:COLOURS.blue, borderRadius:'12px', borderColor:COLOURS.blue}}/>}
                <DefaultButton onClick={onHideClearAllDialog} disabled={clearing} text={!clearingError ? "Cancel" : "Close"} style={{borderRadius:'12px'}}/>
                </DialogFooter>
            </Dialog>
        </section>
    );
}