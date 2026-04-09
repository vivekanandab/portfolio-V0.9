from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# --- MODERN LCEL IMPORTS (Bypassing legacy chains) ---
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

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
prompt = ChatPromptTemplate.from_template("""
You are the elite AI assistant built into Vivekananda Bharupati's portfolio. 
Answer questions based ONLY on the provided context. If the answer is not in the context, say "I don't have that specific data, but you can reach out to Vivek directly."
Keep your answers professional, concise, and highlight Vivek's engineering skills where relevant.

Context: {context}
Question: {input}
""")

# Utility to format the retrieved documents into a single string
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# --- THE MODERN LCEL RAG PIPELINE ---
rag_chain = (
    {"context": retriever | format_docs, "input": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# Define the data structure for incoming requests
class ChatRequest(BaseModel):
    question: str

# The API Endpoint
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    # Using the clean LCEL invoke method
    answer = rag_chain.invoke(req.question)
    return {"answer": answer}


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
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)