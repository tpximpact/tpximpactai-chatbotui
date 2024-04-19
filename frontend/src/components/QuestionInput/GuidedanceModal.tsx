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

const exampleQuestion1 = "I want to learn more about Agile, give me a 7 step plan to improve my understanding, in order of most important to least."
const exampleQuestion2 = `Summarise this article: 
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
 const exampleQuestion3 = `How do I center this div?
<div className={styles.modalHeader}>
  <h2>Generative AI Guidance [DRAFT]</h2>
</div>
`
// Custom Modal Component
const GuideanceModal: React.FC<CustomModalProps> = ({ isOpen, onClose, sendExampleQuestion }) => {
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
        <h2 style={{ textAlign: 'center' }}>Generative AI Guidance [DRAFT]</h2>
      </div>
      <div className={styles.modalSubtitle}>
        <h2>This guidance is to help you safely use Generative AI technologies within your work. </h2>
      </div>
      <div className={styles.modalContent}>
        <p>To find out more about generative AI please visit<a href="https://docs.google.com/presentation/d/1mWjx-UzA_rUSjVI3xTnG6U0lhyJ8ktix6awXOe8fFSM/edit?usp=sharing" target='_blank'>Generative AI - Explainer.</a></p>
        
        <p>
            This guidance, in line with our overarching<a href="https://drive.google.com/file/d/1z1OIfPO3kuyfQ6TalbaDb2Vv4ARYH9Rl/view" target='_blank'>TPXimpact Information Technology, Security & Governance (ITSG) policy,</a> 
            applies to all employees of TPXimpact and our contractor/associate community. This guidance is also aligned to the<a href="https://drive.google.com/file/d/1z1OIfPO3kuyfQ6TalbaDb2Vv4ARYH9Rl/view" target='_blank'>UK Gov policy.</a>
        </p>
        
        <ul>
        <li>We encourage the responsible use of generative AI within your work for innovation and impact.</li>
        <li><strong>Do not enter any client or company information into public services such as ChatGPT, Bing Chat, Claude, or any other similar service.</strong></li>
        <li>Currently, the only generative AI tool that may be used for work purposes is impactAI (our in-house Beta AI service), when the use aligns responsibly with the company's strategic goals and values.</li>
        <li>All other free or paid-for GenAI products are not to be used for work purposes, and therefore, free trials and/or paid-for subscriptions are not to be signed up for by teams.</li>
        <li>It is prohibited to enter, into any public GenAI service, company, or customer information that is private, confidential, specialized, sensitive, or reveals the intent of TPXimpact or our clients (that may not be in the public domain).</li>
        <li>You should have regard for the principles of GDPR and never enter personal information about our people or our clients.</li>
        <li>You should not use GenAI to intentionally produce harmful, misleading, or offensive content.</li>
        <li>Output from consumer GenAI is susceptible to bias and hallucination, any output should be carefully reviewed and validated appropriately.</li>
        </ul>
        <p style={{ border: '1px solid black', padding: '15px 25px', borderRadius: '20px', margin: '5px 0', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
            If a mistake has happened and you are worried about a potential impact on the company or clients, speak to your Line Manager and notify the Information Security & Governance Team via infosec@tpximpact.com who will support you to ensure appropriate action is taken.
        </p>

        <h3 style={{paddingTop:'20px'}}>Examples of appropriate use of public GenAI services</h3>
        
        <p>
            <strong>Appropriate Example 1: Research</strong>
            <br />
            GenAI can serve as a research aid to gather background information on topics relevant to your projects, especially when facing unfamiliar territories. For instance, understanding the latest methodologies of Agile Project Management can be expedited using GenAI.
        </p>
        
        <p>
            <strong>Considerations:</strong>
            <br />
            Ensure that the queries posed do not disclose client or company interests that are confidential.
            <br />
            It may be required to corroborate the information acquired, both formally and informally, with reliable, citable sources.
        </p>

        <div style={{ textAlign: 'right' , marginBottom:'20px'}}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion1)
          }}
          text="Try it with an example"
          color="blue"
        />
      </div>
        <p>
            <strong>Appropriate Example 2: Summarizing Information</strong>
            <br />
            GenAI is capable of condensing publicly accessible information, such as academic or news articles, which can save time while preparing materials.
        </p>
        
        <p>
            <strong>Considerations:</strong>
            <br />
            Ascertain that the content source is publicly accessible.
            <br />
            Evaluate the accuracy of the summary and check for any omission of crucial information.
            <br />
            Does the summary convey the overall sentiment of the original piece?
        </p>
        <div style={{ textAlign: 'right' , marginBottom:'20px'}}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion2)
          }}
          text="Try it with an example"
          color="salmon"
        />
      </div>

        <p>
            <strong>Appropriate Example 3: Developing Code</strong>
            <br />
            Software developers may use GenAI to tackle coding challenges, generate code snippets, draft tests, or facilitate language conversion, thereby saving time and exposing them to potential solutions they might not have considered.
        </p>
        
        <p>
            <strong>Considerations:</strong>
            <br />
            Do not divulge sensitive code or system insights, especially those revealing the security posture of your application.
            <br />
            Diligently review the generated code to ensure it aligns with the intended output and conforms to the latest features and standards of the environment.
        </p>

        <p>
            <strong>Note to our developer community:</strong> we will be investigating the opportunities of specialised AI-pair programming solutions (i.e. Github Copilot), which are noticeably superior to non-fine-tuned models.
        </p>
        <div style={{ textAlign: 'right' }}>
        <ShareButton
          onClick={() => {
            sendExampleQuestion(exampleQuestion3)
          }}
          text="Try it with an example"
          color="green"
        />
      </div>


        <h3 style={{paddingTop:'20px'}}>Examples of inappropriate use of public GenAI services</h3>

        <p>
            <strong>Inappropriate Example 1: Authoring Messages and Summarising Facts on Confidential Topics</strong>
            <br />
            Although GenAI has the ability to craft written outputs in various styles and formats, it's not permitted for creating material regarding sensitive client strategies which you may find in bids or statements of work. To gain a full response, public tools like ChatGPT or Google Bard will require inputting sensitive information, which is a breach of confidentiality.
        </p>
        
        <p>
            <strong>Inappropriate Example 2: Data Analysis on Client or Company Data that is not in the Public Domain</strong>
            <br />
            Before employing GenAI for data analysis, ensure the data is publicly available. Absence of public status prohibits the use of public GenAI for analysing the data.
        </p>

        <h3 style={{paddingTop:'20px'}}>Tips for getting the most out of ChatGPT:</h3>

        <p>
            <strong>Be Precise in Your Instructions:</strong> Clearly articulate your needs. Whether it's a summary, a detailed explanation, or any other request, specify the requirements such as style, key points to cover, or the level of complexity.
        </p>

        <p>
            <strong>Engage with Context:</strong> If you have a specific role in mind for ChatGPT, state it upfront. For instance, if you'd like the AI to respond as a strategist, a software engineer, or even a sci-fi enthusiast, mention it to receive a more focused response.
        </p>

        <p>
            <strong>Iterate and Refine:</strong> Should the initial output not meet your expectations, refine your question or provide feedback. By iterating, you guide the AI towards what you need.
        </p>

        <p>
            <strong>Segment Complex Queries:</strong> If you have a multifaceted question, consider breaking it into smaller, interconnected queries. This allows ChatGPT to provide more detailed and accurate answers for each segment.
        </p>

        <p>
            <strong>Provide a Framework:</strong> If you're looking for a structured response, present an outline or template. ChatGPT can then fill in the details, ensuring the answer adheres to the format you desire.
        </p>

        <p>
            <strong>Check for Bias and Accuracy:</strong> Always evaluate the information provided. While ChatGPT aims to be neutral and factual, it's beneficial to cross-check crucial details, especially in a professional context.
        </p>

        <p>
            <strong>Use British English Settings:</strong> As we prefer British English, it's handy to specify this preference to get the desired linguistic style. You can also set a Custom Instruction, and it will remember.
        </p>

        <p>
            <strong>Challenge and Question:</strong> If in doubt, don't hesitate to challenge the response or ask for clarifications. ChatGPT can provide additional context or elaborate on its answers.
        </p>
        <div style={{ textAlign: 'center' , marginBottom:'30px'}}>

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

export default GuideanceModal;
