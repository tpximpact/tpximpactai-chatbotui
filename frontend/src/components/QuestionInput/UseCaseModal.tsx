import React from 'react';
import { Modal, IconButton, Button } from '@fluentui/react';
import styles from './QuestionInput.module.css'; // Import custom CSS styles for the modal
import { ShareButton } from '../common/Button';

// Define Props for Modal Component
interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  sendExampleQuestion: (question: string) => void;
}

const exampleQuestion1 = `Create an executive summary of this article: 
We're pleased to announce that The Trussell Trust has appointed us as their partner for digital transformation to help build a movement and meet the unprecedented need for their vital services. 

The Trussell Trust is embarking on an exciting and ambitious transformation programme as the charity seeks to meet record demand for support. The programme will touch every part of the network, from people who access food banks, volunteers, and food bank teams on the ground to central teams, supporters and advocates.

Recently published research and insights in the ‘Hunger in the UK’ report show that: “14% of all UK adults (or their households) have experienced food insecurity in the 12 months to mid-2022.” This means – at some point over this period – an estimated 11.3 million people have run out of food and been unable to afford more, and/or reduced meal size, eaten less, gone hungry or lost weight due to lack of money.

Their most recent statistical release showed that a record 540,000 emergency food parcels were provided to support more than 265,000 children across the UK between April and September 2023. Low incomes, especially from social security, debt, health conditions and issues with social security payments such as delays or sanctions, were the main reasons people had no option but to turn to a food bank for help.

The charity forecast that they will distribute more than 1,000,000 emergency food parcels across the UK this winter.

At every turn, The Trussell Trust sees the impact of economic uncertainty on their work, from decreasing food donations to soaring demand for emergency food aid. This partnership could not have come at a more important time, and digital will be vital in meeting these challenges. Teams will work with people who access food banks and local volunteers and staff to understand the needs in communities and translate this into digital support and solutions that help people not only access emergency food aid but also additional support to help move them out of poverty.

Central to The Trussell Trust’s organisational strategy is a commitment to build awareness and a movement for change to end hunger in the UK. This partnership will enable and empower teams to use digital channels and creativity to galvanise the general public and influential partners and reach the widest number of people.

Louise Lai, Chief Client and Transformation Officer of TPXimpact, said:
"We couldn’t be more excited and proud to be joining The Trussell Trust as they embark on the next phase of their strategy and tackle, head-on, the grave challenges facing those in crisis right now. Digital is a huge driver and enabler for change and impact. We’ll be working together to reimagine digital experiences with a focus on outcomes, connecting every part of the digital ecosystem and helping to mobilise teams and audiences to support their mission to end hunger in the UK.

The understanding, commitment, expertise and passion from everyone we’ve met has been incredible. This cause is close to so many of our team's values, and it is humbling and motivating for us all to tackle these challenges. We have an opportunity to work in a genuinely agile way, to deliver impact iteratively, innovate with our platforms and create a user-centred experience led by the data and insights on where help, information, support, influence and impact will matter the most."

Sophie Carre, Director of Public Engagement of The Trussell Trust, said:
"As our food banks provide more emergency food parcels and support than ever, there has never been a more important time for us to accelerate our digital transformation. Delivering seamless digital experiences across our network of food banks to support those facing hardship and engage and mobilise people to pursue our vision to end hunger in the UK.

We’re thrilled to be partnering with TPXimpact, who, from the beginning, have demonstrated their immense expertise and experience, alignment with our values, and passion for putting food banks at the heart of our digital strategy. The enthusiasm, adaptability and strategic thinking of the team is a huge asset to our work and achieving our strategic goals.” 

 `

const exampleQuestion2 = `Anaylse this bid response`
const exampleQuestion3 = `Produce a case study on the use of genAI tools in workplaces`
const exampleQuestion4 = `Generate 5 business ideas involving rubber ducks and elderly people`
const exampleQuestion5 = `Breakdown and explain how Ottolenghi uses texture in his cooking`
const exampleQuestion6 = `Generate some example text for a section of a website about corporate buzzwords`
const exampleQuestion7 = `Write excel formulas to average all alternating rows and weigh them against a normal distribution`
const exampleQuestion8 = `annotate each line of the following code, respond with the code and it's annotations as comments:
const UseCaseModal: React.FC<CustomModalProps> = ({ isOpen, onClose, sendExampleQuestion }) => {
  return (
    <Modal
    styles= {{ root: {overflowY: 'hidden'}, main: {borderRadius:'20px', width: '70%',overflowY: 'hidden'} } }
      isOpen={isOpen}
      onDismiss={onClose}
      isBlocking={false}
    >
    <div className={styles.modalContainer}>
        <IconButton
            onMouseOver={undefined}
          iconProps={{ iconName: 'Cancel', styles: { root: { color: 'black'}}}}
          ariaLabel="Close"
          onClick={onClose}
          styles={{ root: { position: 'absolute', top: '10px', right: '20px', borderRadius:'10px'} }}
          className={styles.closeButton} // Apply custom CSS class for close button
        />
      <div className={styles.modalHeader}>
        <h2 style={{ textAlign: 'center' }}>9 TPXimpactAI Uses For You To Try</h2>
      </div>
      <div className={styles.modalContent}>
`
const exampleQuestion9 = `Why is this div not centered?
<div className={styles.modalHeader}>
  <h2>9 TPXimpactAI Uses For You To Try</h2>
</div>
`

// Custom Modal Component
const UseCaseModal: React.FC<CustomModalProps> = ({ isOpen, onClose, sendExampleQuestion }) => {
  return (
    <Modal
    styles= {{ root: {overflowY: 'hidden'}, main: {borderRadius:'20px', width: '55%',overflowY: 'hidden'} } }
      isOpen={isOpen}
      onDismiss={onClose}
      isBlocking={false}
    >
    <div className={styles.modalContainer}>
        <IconButton
            onMouseOver={undefined}
          iconProps={{ iconName: 'Cancel', styles: { root: { color: 'black'}}}}
          ariaLabel="Close"
          onClick={onClose}
          styles={{ root: { position: 'absolute', top: '10px', right: '20px', borderRadius:'10px'} }}
          className={styles.closeButton} // Apply custom CSS class for close button
        />
      <div className={styles.modalHeader}>
        <h2 style={{ textAlign: 'center' }}>9 Uses For TPXimpactAI That You Can Try</h2>
      </div>
      {/* <div className={styles.modalSubtitle}>
        <h2>Here are some examples of prompts to use in different situations:</h2>
      </div> */}
      <div className={styles.modalContent}>

        <h3 style={{padding:'20px 0px 5px 0px'}}>AI can be a powerful tool. To get the most out of it, you should phrase your questions (prompts) a little diferently than you would to a person or a search engine. 
        <br />
        <br />
        Here are 9 use case ideas and example prompts for them:
        </h3>
        
        <div className = {styles.useCaseContainer}>
        <p className = {styles.useCaseText}>
            <strong>Use Case 1: Document Summaries:</strong>
            <br />
            You can get ImpactAI to condense blocks of text into shorter paragraphs containing just the key points. Play with the tone and style of the summary for different results.
            <br />
            <strong>Note:</strong> There's a limit to how long a prompt can be. To get round this, you can split large documents into chunks and put them in one by one.
        </p>

        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion1)
          }}
          text="Try it"
          color="blue"
        />
      </div>
      </div>


      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 2: Textual Analysis</strong>
            <br />
            You can use TPXimpactAI to go a step further than summarisation by asking it to anaylse a document.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion2)
          }}
          text="Try it"
          color="salmon"
        />
      </div>
      </div>

      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 3: Produce a Case Study</strong>
            <br />
            Quickly generate a case study on any topic.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion3)
          }}
          text="Try it"
          color="green"
        />
      </div>
      </div>

      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 4: New Ideas</strong>
            <br />
            Ask TPXimpactAI to brainstorm some ideas for you.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion4)
          }}
          text="Try it"
          color="blue"
        />
      </div>
      </div>


      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 5: Explain complex topics</strong>
            <br />
            Ask TPXimpactAI to brainstorm some ideas for you.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion5)
          }}
          text="Try it"
          color="green"
        />
      </div>
      </div>


      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 6: Create example text</strong>
            <br />
            Lorem Ipsum is out, use AI to generate more realistic sample text.
        </p>
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion6)
          }}
          text="Try it"
          color="salmon"
          />
        </div>
      </div>


      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 7: Write an Excel forumula</strong>
            <br />
            We won't tell anyone you used AI.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion7)
          }}
          text="Try it"
          color="green"
        />
      </div>
      </div>

      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 8: Annotate or Explain Code</strong>
            <br />
            AI can be surprisingly effective at breaking down code, you can even use it to add comments to explain it to the next person. 
            Try using it the next time you're served a steaming hot plate of spaghetti.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion8)
          }}
          text="Try it"
          color="salmon"
        />
      </div>
      </div>

      <div className = {styles.useCaseContainer}>
      <p className = {styles.useCaseText}>
            <strong>Use Case 9: Debug Code</strong>
            <br />
            You can use TPXimpactAI to find and squash bugs.
        </p>
        
        <div className= {styles.useCaseButtonContainer}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion9)
          }}
          text="Try it"
          color="blue"
        />
      </div>
      </div>

        <p>
            <strong>Remember:</strong> Always check your responses for mistakes and hallucinations. If in doubt, don't hesitate to challenge the response or ask for clarifications. TPXimpactAI can provide additional context or elaborate on its answers.
        </p>
        <div style={{ textAlign: 'center' , marginBottom:'40px'}}>

        <ShareButton
          onClick={() => {
            onClose()
          }}
          text="Get started"
          color="purple"
        />
      </div>
      </div>
    </div>
    
    </Modal>
  );
};

export default UseCaseModal;
