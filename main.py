from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import os
import json
from dotenv import load_dotenv

# --- MODERN LCEL IMPORTS (Bypassing legacy chains) ---
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

# Load environment variables
load_dotenv()

app = FastAPI(title="Vivekananda Portfolio API", version="1.0")

# --- AI RAG BACKEND SETUP ---
print("Initializing AI Brain...")
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
vector_store = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)
retriever = vector_store.as_retriever(search_kwargs={"k": 3})

# Initialize Gemini 1.5 Flash 
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)

# Define the Persona
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are NG Bot (Nanda Gadi Bot), the elite AI chatbot built into Vivekananda (Nanda) Bharupati's portfolio. 
Answer questions based ONLY on the provided context. If the answer is not in the context, say "I don't have that specific data, but you can reach out to Nanda directly."
Keep your answers professional, concise, and highlight Nanda's engineering skills where relevant.

Context: {context}"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}")
])

# Utility to format the retrieved documents into a single string
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# --- THE MODERN LCEL RAG PIPELINE ---
def get_context(inputs):
    docs = retriever.invoke(inputs["question"])
    return format_docs(docs)

rag_chain = (
    RunnablePassthrough.assign(context=get_context)
    | prompt
    | llm
    | StrOutputParser()
)

store = {}
def get_session_history(session_id: str):
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

conversational_rag_chain = RunnableWithMessageHistory(
    rag_chain,
    get_session_history,
    input_messages_key="question",
    history_messages_key="history"
)

# Define the data structure for incoming requests
class ChatRequest(BaseModel):
    question: str
    session_id: str = "default"

class FeedbackRequest(BaseModel):
    question: str
    answer: str
    is_positive: bool

# The API Endpoint
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    async def generate_response():
        async for chunk in conversational_rag_chain.astream(
            {"question": req.question},
            config={"configurable": {"session_id": req.session_id}}
        ):
            yield chunk

    return StreamingResponse(generate_response(), media_type="text/plain")

@app.post("/api/feedback")
async def feedback_endpoint(req: FeedbackRequest):
    data = req.model_dump()
    try:
        feedback_file = "feedback_logs.json"
        if not os.path.exists(feedback_file):
            with open(feedback_file, "w") as f:
                json.dump([], f)
        with open(feedback_file, "r") as f:
            logs = json.load(f)
        logs.append(data)
        with open(feedback_file, "w") as f:
            json.dump(logs, f, indent=4)
        return {"status": "Feedback recorded."}
    except Exception as e:
        return {"status": f"Error: {e}"}


# --- FRONTEND ROUTING ---
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/modules", StaticFiles(directory="modules"), name="modules")

@app.get("/")
async def serve_frontend():
    return FileResponse("index.html")

@app.get("/style.css")
async def serve_css():
    return FileResponse("style.css")

@app.get("/script.js")
async def serve_js():
    return FileResponse("script.js")

if __name__ == "__main__":
    import uvicorn
    import os
    # Cloud Run dynamically assigns a port via the PORT target env var.
    port = int(os.environ.get("PORT", 8080))
    # Must bind to 0.0.0.0 so Cloud Run can route traffic to the container
    uvicorn.run("main:app", host="0.0.0.0", port=port)